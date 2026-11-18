"""Train time-ordered XGBoost goal ensembles; export exact SHAP stump contributions.
No future fixture or post-match statistic is included in a training feature.
"""
import json
from collections import defaultdict
import numpy as np
from scipy.optimize import minimize_scalar
from scipy.stats import skellam
from sklearn.model_selection import TimeSeriesSplit
from xgboost import XGBRegressor

def features(matches):
    history = defaultdict(list)
    x, y = [], []
    for m in sorted(matches, key=lambda g: g['date']):
        def team(key):
            records = history[key][-17:]
            if not records: return 1.5, 1.5, 1.3
            return (sum(r[0] for r in records)/len(records), sum(r[1] for r in records)/len(records), sum(r[2] for r in records[-5:])/len(records[-5:]))
        hf, ha, hp = team(m['h']); af, aa, ap = team(m['a'])
        x.append([hf,ha,af,aa,hp,ap]); y.append([m['hg'],m['ag']])
        for h,g,a in [(m['h'],m['hg'],m['ag']),(m['a'],m['ag'],m['hg'])]: history[h].append((g,a,3 if g>a else int(g==a)))
    return np.asarray(x), np.asarray(y)

def fit(x,y):
    return [XGBRegressor(n_estimators=75, max_depth=1, learning_rate=.085, min_child_weight=30, reg_lambda=8, base_score=1.5, objective='reg:squarederror', n_jobs=1, random_state=17).fit(x,y[:,i]) for i in range(2)]

def probabilities(models,x):
    h,a=[np.clip(m.predict(x),.12,5.5)-.08 for m in models]
    draw=skellam.pmf(0,h,a);away=skellam.cdf(-1,h,a)
    return np.maximum(np.stack([1-draw-away,draw,away],axis=1),1e-10)

def outcome(y): return np.where(y[:,0]>y[:,1],0,np.where(y[:,0]==y[:,1],1,2))
def scale(p,t):
    s=p**(1/t);return s/s.sum(axis=1,keepdims=True)
def calibrated_fit(x,y):
    # Fitting the calibration temperature never sees the subsequent test fold.
    n=int(len(x)*.85);m=fit(x[:n],y[:n]);p=probabilities(m,x[n:]);actual=outcome(y[n:]);t=minimize_scalar(lambda t:-np.log(scale(p,t)[np.arange(len(p)),actual]).mean(),bounds=(.55,1.9),method='bounded').x
    return m,t

def train(matches):
    x,y=features(matches);scores=[]
    for train_idx,test_idx in TimeSeriesSplit(n_splits=5).split(x):
        models,t=calibrated_fit(x[train_idx],y[train_idx]);p=scale(probabilities(models,x[test_idx]),t);actual=outcome(y[test_idx]);oh=np.eye(3)[actual]
        scores.append([np.mean(np.sum((np.cumsum(p,1)[:,:2]-np.cumsum(oh,1)[:,:2])**2,axis=1)/2), -np.log(p[np.arange(len(p)),actual]).mean(), np.mean(np.sum((p-oh)**2,axis=1))])
    models,t=calibrated_fit(x,y)
    result={'base':1.5,'rho':.08,'temp':round(float(t),5),'samples':len(x),'metrics':np.mean(scores,axis=0).round(5).tolist()}
    for key,model in zip(['home','away'],models):
        trees=[]
        for raw in model.get_booster().get_dump(dump_format='json',with_stats=True):
            tree=json.loads(raw)
            if 'split' not in tree:
                v=tree['leaf'];trees.append({'f':0,'t':0,'l':v,'r':v,'mean':v});continue
            l,r=tree['children'];mean=(l['leaf']*l['cover']+r['leaf']*r['cover'])/tree['cover'];trees.append({'f':int(tree['split'][1:]),'t':tree['split_condition'],'l':l['leaf'],'r':r['leaf'],'mean':round(mean,10)})
        result[key]=trees
    return result
