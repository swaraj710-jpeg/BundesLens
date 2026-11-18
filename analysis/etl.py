"""BundesLens public season-snapshot ETL. Run from the repository root.
Sources are recorded below. Archived files are cached for reproducibility.
"""
import csv, io, json, re, time, unicodedata, zipfile, urllib.request as http
from pathlib import Path
from collections import defaultdict, Counter
from datetime import date, datetime
from concurrent.futures import ThreadPoolExecutor
import pandas as pd
CACHE=Path('analysis/.cache');CACHE.mkdir(parents=True,exist_ok=True)
OUT=Path('public/data');OUT.mkdir(parents=True,exist_ok=True)

def fetch(url,path):
    path=Path(path)
    if path.exists(): return path.read_bytes()
    data=http.urlopen(http.Request(url,headers={'User-Agent':'BundesLens/1.0 public research'}),timeout=50).read();path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data);return data

def norm(s):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',str(s).lower()).encode('ascii','ignore').decode())
# Canonical Football-Data identity, display name, code, ESPN ID, source aliases.
CLUBS=[('Bayern Munich','Bayern München','FCB',132,'FC Bayern München|Bayern Munich'),('Leverkusen','Bayer Leverkusen','B04',131,'Bayer 04 Leverkusen|Bayer Leverkusen'),('Dortmund','Borussia Dortmund','BVB',124,'Borussia Dortmund'),('Ein Frankfurt','Eintracht Frankfurt','SGE',125,'Eintracht Frankfurt|Eint Frankfurt'),('RB Leipzig','RB Leipzig','RBL',11420,'RasenBallsport Leipzig'),('Stuttgart','VfB Stuttgart','VFB',134,'VfB Stuttgart'),('Freiburg','SC Freiburg','SCF',126,'SC Freiburg'),('Mainz','Mainz 05','M05',2950,'1. FSV Mainz 05|Mainz 05'),("M'gladbach",'Borussia M’gladbach','BMG',268,'Borussia Mönchengladbach|Borussia M.Gladbach|Gladbach'),('Wolfsburg','VfL Wolfsburg','WOB',138,'VfL Wolfsburg'),('Union Berlin','Union Berlin','FCU',598,'1. FC Union Berlin'),('Hoffenheim','TSG Hoffenheim','TSG',7911,'TSG Hoffenheim'),('Augsburg','FC Augsburg','FCA',3841,'FC Augsburg'),('Werder Bremen','Werder Bremen','SVW',137,'SV Werder Bremen'),('Bochum','VfL Bochum','BOC',121,'VfL Bochum'),('Heidenheim','1. FC Heidenheim','FCH',6418,'1. FC Heidenheim 1846|FC Heidenheim'),('St Pauli','FC St. Pauli','STP',270,'FC St. Pauli|St. Pauli'),('Holstein Kiel','Holstein Kiel','KSV',7884,'Holstein Kiel'),('FC Koln','1. FC Köln','KOE',122,'1. FC Köln|FC Cologne|Köln'),('Darmstadt','Darmstadt 98','D98',3812,'SV Darmstadt 98|Darmstadt 98'),('Hamburg','Hamburger SV','HSV',127,'Hamburger SV'),('Elversberg','SV Elversberg','ELV',10388,'SV 07 Elversberg'),('Paderborn','SC Paderborn','SCP',3307,'SC Paderborn 07'),('Schalke 04','Schalke 04','S04',133,'FC Schalke 04')]
CLUBS.extend([('Hertha','Hertha BSC','BSC',129,'Hertha Berlin|Hertha BSC Berlin'),('Bielefeld','Arminia Bielefeld','DSC',2506,'DSC Arminia Bielefeld'),('Greuther Furth','SpVgg Greuther Fürth','SGF',3070,'Greuther Fuerth|SpVgg Greuther Fürth')])
ALIASES={norm(v):r[0] for r in CLUBS for v in [r[0],r[1],r[2],*r[4].split('|')]}
def ident(s):return ALIASES.get(norm(s),s)

def datasets():
    specs=[('matches','fahrisyaifullah/european-football-leagues-match-statistics-dataset','bundesliga_raw.csv'),('scouting','hubertsidorowicz/football-players-stats-2024-2025','players_data_light-2024_2025.csv'),('scouting23','mamounkabbaj/2023-2024-big-5-european-soccer-player-statistics','big_5_players_stats_2023_2024.csv'),('players25','chuongtrinh/top-5-league-individual-stats-season-20252026','PERFECT_scouting_data_2026.csv'),('players26','hiuhiuthen/understat-player-league-2025-26','understat_player_league_2025_26.csv')]
    for key,slug,file in specs:
        root=CACHE/key
        if (root/file).exists():continue
        try:
            z=zipfile.ZipFile(io.BytesIO(fetch('https://api.kaggle.com/v1/datasets/download/'+slug,CACHE/(key+'.zip'))));root.mkdir(exist_ok=True)
            for name in z.namelist():
                if name.endswith('.csv'):(root/Path(name).name).write_bytes(z.read(name))
        except Exception as e:print('Optional supporting archive:',key,str(e))
    fetch('https://raw.githubusercontent.com/vibedatascience/understat_players_aggregated/main/understat_players_aggregated_2014_td.csv',CACHE/'players')

def read_matches(year):
    y=str(year);fetch('https://www.football-data.co.uk/mmz4281/'+y[2:]+str(year+1)[2:]+'/D1.csv',CACHE/y)
    df=pd.read_csv(CACHE/y,encoding='utf-8-sig',encoding_errors='replace').dropna(subset=['FTHG','FTAG','HomeTeam','AwayTeam']);out=[]
    for i,r in enumerate(df.to_dict('records')):
        g={'h':r['HomeTeam'],'a':r['AwayTeam'],'hg':int(r['FTHG']),'ag':int(r['FTAG']),'date':pd.to_datetime(r['Date'],dayfirst=True,format='mixed').strftime('%Y-%m-%d'),'md':i//9+1}
        for k,col in [('hs','HS'),('as','AS'),('hst','HST'),('ast','AST')]:g[k]=int(0 if pd.isna(r.get(col)) else r[col])
        if not pd.isna(r.get('HxG')):g.update(hx=float(r['HxG']),ax=float(r['AxG']))
        out.append(g)
    return out

def players_for(y):
    out=[]
    if y==2024:
        folder=CACHE/('scouting' if y==2024 else 'scouting23');files=sorted(folder.glob('*.csv'));file=next((f for f in files if 'light'in f.name),files[0] if files else None)
        if file:
            df=pd.read_csv(file,encoding='utf-8',encoding_errors='replace');df=df[df.Comp.str.contains('Bundesliga',na=False)]
            for i,r in enumerate(df.fillna(0).to_dict('records')):
                try:out.append(dict(id=str(y)+'p'+str(i),name=r['Player'],club=ident(r['Squad']),pos=r['Pos'].split(',')[0],g=int(r['Gls']),xg=float(r['xG']),xa=float(r['xA']),minutes=int(str(r['Min']).replace(',','')),shots=int(r['Sh']),kp=int(r['KP']),npxg=float(r['npxG']),assists=int(r['Ast']),prog=float(r['PrgP']),sca=float(r['SCA']),rec=float(r['Recov'])))
                except (ValueError,KeyError):continue
            if out:return out,'FBref season archive · observed per-90 metrics'
    if y==2025:
        df=pd.read_csv(next((CACHE/'players25').glob('*.csv')));df=df[df.league=='GER-Bundesliga'];u=pd.read_csv(next((CACHE/'players26').glob('*.csv')));u=u[u.league=='Bundesliga'];under={norm(r['player_name']):r for r in u.to_dict('records')}
        for i,r in enumerate(df.fillna(0).to_dict('records')):
            p=under.get(norm(r['player']),{});out.append(dict(id='25p'+str(i),name=r['player'],club=ident(r['team']),pos=r['pos_'].split(',')[0],g=int(r['Performance_Gls']),xg=round(float(p.get('xg',r['xg_under'] or r['expectedGoals'])),4),xa=round(float(p.get('xa',r['xa_under'] or r['expectedAssists'])),4),minutes=int(r['Playing Time_Min']),shots=int(r['Standard_Sh']),kp=int(r['keyPasses']),npxg=round(float(p.get('npxg',r['np_xg_under'])),4),assists=int(r['Performance_Ast']),rec=int(r['ballRecovery'])))
        return out,'FBref / Understat season archive · progression and creation proxies'
    df=pd.read_csv(CACHE/'players');df=df[(df.league=='Bundesliga')&(df.year==y)];
    for _,r in df.iterrows():out.append(dict(id=str(r.id),name=r.player_name,club=ident(r.team_title.split(',')[-1]),pos={'F':'FW','M':'MF','D':'DF','GK':'GK'}.get(r.position.split()[0],'MF'),g=int(r.goals),xg=round(r.xG,4),xa=round(r.xA,4),minutes=int(r.time),shots=int(r.shots),kp=int(r.key_passes),npxg=round(r.npxG,4),assists=int(r.assists)))
    if y==2023:
        advanced=pd.read_csv(CACHE/'scouting23'/'big_5_players_stats_2023_2024.csv');stats={norm(v['Player']):v for v in advanced[advanced.Competition.str.contains('Bundesliga')].fillna(0).to_dict('records')}
        for p in out:
            if norm(p['name']) in stats:p['prog']=int(stats[norm(p['name'])]['Progression_PrgP'])
    return out,'Understat / FBref season archive'

def goal_name(name,players,club):
    name=name.strip();matches=[p['name'] for p in players if p['club']==club and (norm(p['name'])==norm(name) or (norm(p['name'].split()[-1])==norm(name.split()[-1]) and norm(p['name'])[0]==norm(name)[0]))];return matches[0] if len(matches)==1 else name

def build_season(y,archive=True):
        all_matches={yr:read_matches(yr) for yr in range(y-3,y+1)};adv=pd.read_csv(CACHE/'matches'/'bundesliga_raw.csv')
        season=all_matches[y];ids={m[k]for m in season for k in ['h','a']};assert len(ids)==18
        clubs=[dict(id=c[0],name=c[1],short=c[2],logo='/crests/'+c[2]+'.png') for c in CLUBS if c[0]in ids]
        def crest(c):
            meta=next(r for r in CLUBS if r[0]==c['id']);fetch('https://a.espncdn.com/i/teamlogos/soccer/500/'+str(meta[3])+'.png','public'+c['logo'])
        with ThreadPoolExecutor(max_workers=8)as pool:list(pool.map(crest,clubs))
        p,source=players_for(y);ol=json.loads(fetch('https://api.openligadb.de/getmatchdata/bl1/'+str(y),CACHE/('ol'+str(y))));lookup={(ident(m['team1']['teamName']),ident(m['team2']['teamName'])):m for m in ol};xdata={(ident(r['home_team']),ident(r['away_team'])):r for r in adv[adv.season_id==y].to_dict('records')}
        for m in season:
            r=xdata.get((m['h'],m['a']));
            if r:
                for k,field in [('hx','home_xg'),('ax','away_xg'),('hxp','home_expected_points'),('axp','away_expected_points'),('hpp','home_ppda'),('app','away_ppda'),('hnp','home_np_xg'),('anp','away_np_xg')]:m[k]=round(float(r[field]),5) if not pd.isna(r[field]) else None
            if 'hx' not in m:raise ValueError('Missing recorded xG: '+str(m))
            g=lookup.get((m['h'],m['a']));counts=Counter()
            if g:
                m['md']=g['group']['groupOrderID'];sh=sa=0
                for e in sorted(g['goals'],key=lambda e:(e['scoreTeam1']+e['scoreTeam2'])):
                    side=m['h'] if e['scoreTeam1']>sh else m['a'];sh,sa=e['scoreTeam1'],e['scoreTeam2'];name=e.get('goalGetterName')
                    if e.get('isOwnGoal') or not name:continue
                    counts[goal_name(name,p,side),side]+=1
            m['scorers']=[[name,club,count]for (name,club),count in counts.items()]
        season.sort(key=lambda m:(m['md'],m['date']));xsource='Observed Understat match xG, non-penalty xG, PPDA and shot-distribution xPts.'
        assert len(clubs)==18 and len(season)==306 and all(sum(g['md']==d for g in season)==9 for d in range(1,35)),f'Incomplete schedule for {y}'
        history=[{k:m[k] for k in ['h','a','hg','ag','date','md']} for yr in range(y-3,y) for m in all_matches[yr]];prior=all_matches[y-1]
        output=dict(year=str(y),clubs=sorted(clubs,key=lambda c:c['name']),matches=season,history=history,players=p,playerSource=source,updated=max(m['date']for m in season),prevAvg=sum(m['hg']+m['ag']for m in prior)/len(prior),xgSource=xsource)
        if archive:(OUT/(str(y)+'.json')).write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'),allow_nan=False))
        print(y,'verified 18 clubs, 34 complete matchdays, 306 fixtures',flush=True);return output
def main():
    datasets()
    for y in range(2021,2026):build_season(y)
if __name__=='__main__':main()
