"""Reproducible goal modelling, whole-matchday bootstrap and forward validation.
Run after etl/clean_bundesliga.py: OPENBLAS_NUM_THREADS=1 python models/ensemble_pipeline.py
The supplied benchmark targets are not used to fit, validate or fabricate results.
"""
from pathlib import Path
import json, math, sys
from collections import defaultdict
from datetime import date
import numpy as np
from scipy.optimize import minimize, minimize_scalar
from scipy.special import gammaln
from scipy.stats import skellam
from xgboost import XGBRegressor
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'analysis'))
from etl import build_season
RHO=-.11; SEED=1997; REPS=120

def states(past):
    teams=defaultdict(list);elo=defaultdict(lambda:1500.)
    for m in sorted(past,key=lambda v:v['date']):
        h,a=m['h'],m['a'];hg,ag=m['hg'],m['ag'];win=float(hg>ag)+.5*(hg==ag)
        delta=20*(win-1/(1+10**((elo[a]-elo[h]-60)/400)));elo[h]+=delta;elo[a]-=delta
        for home in [True,False]:
            key=h if home else a;teams[key].append((m['hx']-m['ax'] if home else m['ax']-m['hx'],(m.get('hpp' if home else 'app') or 12),m.get('hnp' if home else 'anp') or 0,m['hs' if home else 'as'],m['date']))
    return teams,elo

def covariates(teams,elo,m,cut):
    def profile(k):
        r=teams[k][-5:]
        if not r:return [0.,12.,7.,.1]
        return [np.mean([v[0]for v in r]),np.mean([v[1]for v in r]),min(21,(date.fromisoformat(cut)-date.fromisoformat(r[-1][4])).days),sum(v[2]for v in r)/max(1,sum(v[3]for v in r))]
    h=profile(m['h']);a=profile(m['a']);return [h[0]-a[0],a[1]-h[1],(elo[m['h']]-elo[m['a']]+60)/400,h[2]-a[2],h[3]-a[3]]

def features(seasons):
    rows=[];previous=[]
    for y,ms in seasons.items():
        for md in range(1,35):
            games=[m for m in ms if m['md']==md];cut=min(m['date']for m in games)
            prior=[m for m in previous+ [g for g in ms if g['md']<md] if m['date']<cut];team,elo=states(prior)
            for m in games:rows.append((y,md,cut,m['date'],covariates(team,elo,m,cut),[m['hg'],m['ag']]))
        previous+=ms
    return rows

def fit(x,y):
    mu=x.mean(0);sd=np.maximum(x.std(0),.001);z=np.column_stack([np.ones(len(x)),(x-mu)/sd]);hg,ag=y.T
    # Joint likelihood: two conditional Poisson rates times Dixon–Coles tau.
    def objective(beta):
        bh,ba=beta.reshape(2,6);uh=z@bh;ua=z@ba;h=np.exp(np.clip(uh,-2,1.7));a=np.exp(np.clip(ua,-2,1.7));tau=np.ones(len(x));dh=np.zeros(len(x));da=dh.copy()
        i=(hg==0)&(ag==0);tau[i]=1-RHO*h[i]*a[i];dh[i]=da[i]=-RHO*h[i]*a[i]
        i=(hg==0)&(ag==1);tau[i]=1+RHO*h[i];dh[i]=RHO*h[i]
        i=(hg==1)&(ag==0);tau[i]=1+RHO*a[i];da[i]=RHO*a[i]
        tau[(hg==1)&(ag==1)]=1-RHO
        pen=beta.reshape(2,6).copy();pen[:,0]=0
        loss=(h+a-hg*np.log(h)-ag*np.log(a)-np.log(tau)).sum()+6*(pen**2).sum()
        grad=np.r_[z.T@((h-hg-dh/tau)*((uh>=-2)&(uh<=1.7))),z.T@((a-ag-da/tau)*((ua>=-2)&(ua<=1.7)))]+12*pen.ravel()
        return loss,grad
    opt=minimize(objective,np.zeros(12),method='L-BFGS-B',jac=True,options={'maxiter':80});beta=opt.x.reshape(2,6);dc=[]
    for b in beta:dc.append([b[0]-np.sum(b[1:]*mu/sd),*(b[1:]/sd)])
    trees=[]
    for i in range(2):
        model=XGBRegressor(n_estimators=36,max_depth=1,learning_rate=.10,base_score=1.5,min_child_weight=12,reg_lambda=7,n_jobs=1,random_state=SEED,objective='reg:squarederror').fit(x,y[:,i]);stumps=[]
        for t in model.get_booster().get_dump(dump_format='json'):
            s=json.loads(t)
            stumps.append([int(s['split'][1:]),s['split_condition'],s['children'][0]['leaf'],s['children'][1]['leaf']] if 'split'in s else [0,0,s['leaf'],s['leaf']])
        trees.append(np.round(stumps,6).tolist())
    return {'dc':np.round(dc,7).tolist(),'trees':trees,'temp':1.}

def outcome(lam,mu,rho):
    # Exact low-score adjustment to the independent Skellam 1X2 probabilities.
    k=rho*lam*mu*np.exp(-lam-mu);a=skellam.cdf(-1,lam,mu)+k;d=skellam.pmf(0,lam,mu)-2*k
    return np.stack([1-a-d,d,a],1)

def base_probs(m,x):
    dc=np.exp(np.clip(np.column_stack([np.ones(len(x)),x])@np.asarray(m['dc']).T,-2,1.7));tree=np.full((len(x),2),1.5)
    for i,ts in enumerate(m['trees']):
        for f,t,l,r in ts:tree[:,i]+=np.where(x[:,int(f)]<t,l,r)
    tree=np.clip(tree,.14,5.5);return (outcome(*dc.T,RHO)+outcome(*tree.T,0))*.5

def calibrate(p,t):
    q=p**(1/t);return q/q.sum(1,keepdims=True)
def labels(y):return np.where(y[:,0]>y[:,1],0,np.where(y[:,0]==y[:,1],1,2))
def trained(x,y,train,cal):
    m=fit(x[train],y[train]);p=base_probs(m,x[cal]);truth=labels(y[cal]);m['temp']=round(float(minimize_scalar(lambda t:-np.log(calibrate(p,t)[np.arange(len(cal)),truth]).mean(),method='bounded',bounds=(.55,2.)).x),6);return m

def main():
    seasons={2020:build_season(2020,archive=False)['matches']};docs={}
    for yr in range(2021,2026):
        path=ROOT/'public/data'/f'{yr}.json';docs[yr]=json.loads(path.read_text());seasons[yr]=docs[yr]['matches']
    rows=features(seasons);years=np.array([r[0] for r in rows]);days=np.array([r[1]for r in rows]);dates=np.array([r[3]for r in rows]);groups=years*100+days;x=np.asarray([r[4]for r in rows]);y=np.asarray([r[5]for r in rows]);rng=np.random.default_rng(SEED)
    for yr,doc in docs.items():
        prev=np.where(years<yr)[0];group=np.unique(groups[prev]);cg=group[-max(5,len(group)//6):];train=prev[~np.isin(groups[prev],cg)];cal=prev[np.isin(groups[prev],cg)];main_model=trained(x,y,train,cal)
        # Distinct training/calibration blocks; every bootstrap refits both learners.
        def sample(idx):
            gs=np.unique(groups[idx]);return np.concatenate([idx[groups[idx]==g] for g in rng.choice(gs,len(gs),replace=True)])
        replicas=[trained(x,y,sample(train),sample(cal))for _ in range(REPS)]
        held=[];actual=[];folds=[]
        for md in range(1,35):
            test=np.where((years==yr)&(days==md))[0];cut=min(rows[i][2]for i in test);eligible=np.where((groups<yr*100+md)&(dates<cut))[0];gs=np.unique(groups[eligible]);c=gs[-max(5,len(gs)//6):];ct=eligible[np.isin(groups[eligible],c)];tr=eligible[~np.isin(groups[eligible],c)];assert max(dates[eligible])<cut
            mm=trained(x,y,tr,ct);pred=calibrate(base_probs(mm,x[test]),mm['temp']);held.extend(pred);actual.extend(labels(y[test]));folds.append({'md':md,'cutoff':cut,'train':len(tr),'calibrate':len(ct),'test':len(test)})
        p=np.asarray(held);truth=np.asarray(actual);oh=np.eye(3)[truth];metrics=[np.mean(np.sum((np.cumsum(p,axis=1)[:,:2]-np.cumsum(oh,axis=1)[:,:2])**2,axis=1)/2),-np.mean(np.log(p[np.arange(len(p)),truth])),np.mean(np.sum((p-oh)**2,axis=1))]
        bins=[]
        for j in range(10):
            mask=(p[:,0]>=j/10)&(p[:,0]<(j+1)/10)
            if mask.any():bins.append({'x':round(float(p[mask,0].mean()),5),'y':round(float((truth[mask]==0).mean()),5),'n':int(mask.sum())})
        prior=[m for yy,ms in seasons.items() if yy<yr for m in ms];_,elo=states(prior)
        research={'fit':main_model,'replicates':replicas,'background':x[rng.choice(train,12,replace=False)].round(6).tolist(),'elo':dict(elo),'metrics':np.round(metrics,6).tolist(),'bins':bins,'samples':len(train),'calibration':len(cal),'heldout':len(truth),'folds':folds,'rho':RHO}
        doc['research']=research;doc.pop('model',None);path=ROOT/'public/data'/f'{yr}.json';path.write_text(json.dumps(doc,separators=(',',':'),ensure_ascii=False,allow_nan=False));print(yr,'34 forward folds',len(truth),'held-out fixtures',np.round(metrics,4),'bootstrap',REPS,flush=True)
if __name__=='__main__':main()
