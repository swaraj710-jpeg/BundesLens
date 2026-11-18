"""A self-contained, credential-free source archive for the architecture modal."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
out=Path('public/downloads/bundeslens-source.zip');out.parent.mkdir(parents=True,exist_ok=True)
with ZipFile(out,'w',ZIP_DEFLATED,compresslevel=7,strict_timestamps=False) as z:
    for dirname in ['src','api','server','analysis','etl','notebooks','models','frontend','tests','public']:
        for p in Path(dirname).rglob('*'):
            if not p.is_file() or p==out or any(s in p.parts for s in ['.cache','__pycache__','downloads']):continue
            z.write(p,'bundeslens/'+str(p))
    for f in ['README.md','package.json','package-lock.json','index.html','vite.config.ts','tsconfig.json','tsconfig.app.json','tsconfig.node.json','.v ite-source-tags.js'.replace(' ','')]:
        if Path(f).is_file():z.write(f,'bundeslens/'+f)
    z.writestr('bundeslens/.env.example','NEXT_PUBLIC_SUPABASE_URL=\nNEXT_PUBLIC_SUPABASE_ANON_KEY=\nSUPABASE_SERVICE_ROLE_KEY=\n')
print('Source archive:',out.stat().st_size,'bytes')
