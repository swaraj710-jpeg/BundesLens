"""Finite, build-only browser verification. No development server required."""
import csv, functools, http.server, json, os, threading
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright
class Static(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):
        if self.path.startswith('/api/seasons?'):
            self.path='/data/'+parse_qs(urlparse(self.path).query)['year'][0]+'.json'
        return super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Static,directory='dist'))
threading.Thread(target=server.serve_forever,daemon=True).start();origin=os.environ.get('TEST_ORIGIN','http://127.0.0.1:'+str(server.server_port));errors=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(args=['--no-sandbox']);p=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1);p.on('pageerror',lambda e:errors.append(str(e)));p.set_default_timeout(10000)
    p.goto(origin);p.wait_for_selector('.standings');p.wait_for_timeout(550)
    assert p.get_by_label('Season',exact=True).input_value()=='2025'
    assert p.get_by_label('Matchday range',exact=True).input_value()=='0'
    assert p.get_by_label('Season',exact=True).locator('option').all_text_contents()==['2025/26','2024/25','2023/24','2022/23','2021/22']
    archive=json.loads(Path('public/data/2025.json').read_text())
    assert p.locator('.kpi-goals .kpi-main>b').inner_text()==str(sum(m['hg']+m['ag'] for m in archive['matches']))
    p.get_by_label('Season',exact=True).select_option('2023');p.wait_for_selector('.standings')
    assert p.locator('.kpi-goals .kpi-main>b').inner_text()=='985'
    assert p.locator('.standings tbody tr').first.locator('.points').inner_text()=='90'
    assert p.locator('.standings tbody tr').first.locator('.record').inner_text()=='28-6-0'
    assert p.locator('.legend-toggle').all_text_contents()==['B04','VFB','FCB','RBL']
    assert p.locator('.rank.playoff').inner_text()=='16' if p.locator('.rank.playoff').is_visible() else p.locator('.rank.playoff').text_content()=='16'
    assert p.locator('.rank.rl').all_text_contents()==['17','18']
    assert 'Bayern München' in p.locator('.scorer-card').inner_text()
    assert p.locator('.standings tbody tr:visible').count()==6
    p.get_by_role('button',name='View all 18 clubs').click();assert p.locator('.standings tbody tr:visible').count()==18
    p.get_by_role('button',name='Show top 6').click();p.get_by_title('Sort by GD',exact=True).click()
    p.get_by_label('Standings venue').select_option('home');assert p.locator('.standings tbody tr:visible').first.locator('td').nth(2).inner_text()=='17'
    p.get_by_label('Standings venue').select_option('all');p.get_by_label('Matchday range',exact=True).select_option('1');p.wait_for_timeout(360);assert p.locator('.kpi-goals .kpi-main>b').inner_text()!='985';assert '10'==p.locator('.standings tbody tr').first.locator('td').nth(2).inner_text()
    series=[b.get_attribute('aria-label') for b in p.locator('.legend-toggle').all()];assert series==['Toggle '+c+' trajectory' for c in p.locator('.standings .club-link span').all_text_contents()[:4]]
    p.get_by_label('Matchday range',exact=True).select_option('0');p.wait_for_timeout(380)
    p.locator('.standings tbody tr').first.locator('.club-link').click();p.wait_for_selector('.team-banner');p.get_by_label('Select club',exact=True).select_option('Dortmund');assert 'Borussia Dortmund' in p.locator('.team-id h2').inner_text();p.get_by_label('Comparison scale').select_option('total');assert p.locator('.gauge-value b').inner_text()!='NaN'
    p.get_by_role('button',name='Player Scouting',exact=True).click();p.wait_for_selector('.player-table');p.get_by_label('Search players').fill('Wirtz');assert p.locator('.player-table tbody tr').count()==1;p.get_by_role('button',name='Compare A',exact=True).click();assert 'Wirtz' in p.locator('.cmp-0 option:checked').inner_text();p.get_by_label('Search players').fill('zzzzzz');assert 'No players match' in p.locator('.empty-state').inner_text();p.get_by_label('Search players').fill('');p.get_by_role('button',name='GK',exact=True).click();assert p.locator('.player-table tbody tr').count()>0
    p.get_by_role('button',name='Match Predictor',exact=False).first.click();p.wait_for_selector('.probabilities');initial=p.locator('.probabilities').inner_text();p.get_by_label('Home team',exact=True).select_option('Freiburg');assert p.locator('.probabilities').inner_text()!=initial;p.get_by_label('Venue advantage').fill('90');assert p.locator('.scorelines>div').count()==5;assert abs(sum(float(v.replace('%','')) for v in p.locator('.probabilities b').all_text_contents())-100)<.2
    odds=p.get_by_role('button',name='Show Fair Odds (1/p)',exact=True);odds.click();assert p.locator('.fair-odds').count()==3
    for val,quote in zip(p.locator('.probabilities b').all_text_contents(),p.locator('.fair-odds').all_text_contents()):assert abs(100/float(val.rstrip('%'))-float(quote.rstrip('×')))<.01
    left=p.get_by_label('Home team',exact=True).input_value();right=p.get_by_label('Away team',exact=True).input_value();before=p.locator('.probabilities').inner_text();p.get_by_label('Swap home and away teams').click();assert p.get_by_label('Home team',exact=True).input_value()==right and p.get_by_label('Away team',exact=True).input_value()==left and p.locator('.probabilities').inner_text()!=before
    p.get_by_label('Swap home and away teams').click();assert p.locator('.probabilities').inner_text()==before;odds.click();assert p.locator('.fair-odds').count()==0
    modes=[]
    for b in p.locator('.model-picker button').all():
        b.click();modes.append(p.locator('.probabilities').inner_text());assert p.locator('.prob-reading small').count()==3;assert p.locator('.drivers>div').count()==6
        additions=sum(float(n.replace(' pp',''))for n in p.locator('.drivers code').all_text_contents());assert abs(39.3+additions-float(p.locator('.probabilities b').first.inner_text().rstrip('%')))<1e-8
    assert len(set(modes))==3
    p.get_by_role('button',name='Download report',exact=True).click();
    with p.expect_download() as dl:p.get_by_role('button',name='CSV dataset',exact=False).click()
    assert dl.value.suggested_filename.endswith('.csv')
    p.get_by_role('button',name='Methodology',exact=True).click();p.wait_for_selector('.pipeline');assert p.locator('.pipeline-step').count()==5;p.get_by_role('button',name='04Model training',exact=False).click();assert p.locator('.accordion p').is_visible()
    assert p.locator('.ablation tbody tr').count()==4;p.get_by_role('button',name='Inspect fold boundaries').click();assert p.locator('.fold-report tbody tr').count()==34
    repo='https://github.com/swaraj710-jpeg/bundeslens';assert p.get_by_role('link',name='GitHub Repo').get_attribute('href')==repo
    p.get_by_role('link',name='GitHub Repo').click();p.wait_for_selector('.repo-tree');p.get_by_role('button',name='/models/ensemble_pipeline.py').click();assert p.locator('.file-preview b').inner_text()=='Model training';assert p.get_by_role('link',name='Open GitHub repository').get_attribute('href')==repo;assert p.locator('.repo-tree code').inner_text()==f'git clone {repo}.git';p.keyboard.press('Escape');assert p.locator('[role=dialog]').count()==0
    p.get_by_role('button',name='League Overview',exact=True).click();p.wait_for_selector('.standings');p.get_by_label('Expand efficiency chart').click();assert p.get_by_role('dialog').is_visible();p.keyboard.press('Escape');p.get_by_label('Toggle Bayern München trajectory').click();assert p.get_by_label('Toggle Bayern München trajectory').get_attribute('aria-pressed')=='false'
    for y in ['2021','2022','2023','2025']:
        p.get_by_label('Season',exact=True).select_option(y);p.wait_for_selector('.standings');assert p.locator('.standings tbody tr').count()==18
    p.get_by_label('Matchday range',exact=True).select_option('3');p.wait_for_timeout(360);p.wait_for_selector('.standings');assert p.locator('.standings tbody tr').first.locator('td').nth(2).inner_text()=='12'
    p.get_by_label('Season',exact=True).select_option('2024');p.get_by_label('Matchday range',exact=True).select_option('0');p.wait_for_selector('.standings');p.get_by_label('Switch to light mode').click();assert p.locator('html').get_attribute('data-theme')=='light';p.screenshot(path='uploads/light-test.png');p.get_by_label('Switch to dark mode').click()
    p.get_by_role('button',name='Collapse sidebar').click();assert 'rail' in p.locator('.app').get_attribute('class');p.locator('.collapse').click();p.wait_for_timeout(500);p.screenshot(path='uploads/desktop-final.png')
    p.emulate_media(media='print');assert p.locator('.standings tbody tr:visible').count()==18;p.emulate_media(media='screen')
    for width in [375,390,768,1024,1280]:
        p.set_viewport_size({'width':width,'height':844});p.wait_for_timeout(220);assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),('overflow',width)
    p.set_viewport_size({'width':390,'height':844});p.wait_for_timeout(350);assert p.locator('.main-shell').bounding_box()['x']==0;p.screenshot(path='uploads/mobile-final.png');p.get_by_label('Open navigation').click();p.get_by_role('button',name='Player Scouting',exact=True).click();p.wait_for_selector('.player-table');assert not p.locator('.scrim').count();assert p.evaluate('document.documentElement.scrollWidth<=innerWidth');p.get_by_label('Open navigation').click();p.get_by_role('button',name='Match Predictor',exact=False).first.click();p.wait_for_selector('.fixture-select');assert p.evaluate('document.documentElement.scrollWidth<=innerWidth');p.screenshot(path='uploads/predictor-mobile.png');
    assert not errors,errors
    print('PASS: 5 complete seasons, 3 forecasting architectures, confidence intervals, SHAP contributions, validation folds, repository preview, all original views, exports, and responsive layouts. No runtime exceptions.')
    browser.close()
server.shutdown()
