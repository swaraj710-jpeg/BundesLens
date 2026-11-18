"""Calibrate the requested fixed 55:45 simulator blend, without retraining either learner.
Run from the repository root. The existing 50:50 research report is a frozen experiment.
Only prior-season, held-out calibration rounds are used. Reproduce bootstrap block IDs
with the same RNG sequence as ensemble_pipeline.py. No test-season outcomes are used.
"""
import json
import numpy as np
from scipy.optimize import minimize_scalar
from ensemble_pipeline import ROOT, SEED, build_season, features, outcome, labels, calibrate, RHO

def temperature(fit, x, y):
    dc=np.exp(np.clip(np.column_stack([np.ones(len(x)),x])@np.asarray(fit['dc']).T,-2,1.7))
    trees=np.full((len(x),2),1.5)
    for i,stumps in enumerate(fit['trees']):
        for f,t,l,r in stumps:trees[:,i]+=np.where(x[:,int(f)]<t,l,r)
    # Standard venue setting exactly matches the training venue assumption.
    p=.55*outcome(*dc.T,RHO)+.45*outcome(*np.clip(trees,.14,5.5).T,0)
    truth=np.cumsum(np.eye(3)[labels(y)],axis=1)[:,:2]
    def rps(t):return np.mean(np.sum((np.cumsum(calibrate(p,t),axis=1)[:,:2]-truth)**2,axis=1)/2)
    fit_t=minimize_scalar(rps,bounds=(.55,2.),method='bounded').x
    return round(float(fit_t),8)

def main():
    docs={y:json.loads((ROOT/f'public/data/{y}.json').read_text()) for y in range(2021,2026)}
    seasons={2020:build_season(2020,archive=False)['matches'],**{y:d['matches']for y,d in docs.items()}}
    rows=features(seasons);years=np.array([r[0]for r in rows]);groups=years*100+np.array([r[1]for r in rows]);x=np.asarray([r[4]for r in rows]);y=np.asarray([r[5]for r in rows]);rng=np.random.default_rng(SEED);out={}
    for year,doc in docs.items():
        prev=np.where(years<year)[0];gs=np.unique(groups[prev]);last=gs[-max(5,len(gs)//6):];tr=prev[~np.isin(groups[prev],last)];cal=prev[np.isin(groups[prev],last)];research=doc['research']
        assert len(cal)==research['calibration'] and len(tr)==research['samples']
        point=temperature(research['fit'],x[cal],y[cal]);temps=[]
        for model in research['replicates']:
            tg=np.unique(groups[tr]);rng.choice(tg,len(tg),replace=True)
            picked=np.concatenate([cal[groups[cal]==g] for g in rng.choice(last,len(last),replace=True)])
            temps.append(temperature(model,x[picked],y[picked]))
        bg=x[rng.choice(tr,12,replace=False)].round(6);assert np.allclose(bg,research['background'])
        out[year]={'temperature':point,'replicateTemperatures':temps}
        print(year, 'RPS-calibrated 55:45 stack;',len(cal),'prior calibration fixtures;',len(temps),'bootstrap fits')
    (ROOT/'src/stackCalibration.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
if __name__=='__main__':main()
