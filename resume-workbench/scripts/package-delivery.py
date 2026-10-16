"""Create clean source/browser archives; never include old resumes or local profiles."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib, json

root = Path(__file__).resolve().parent.parent
output = root / 'outputs'
output.mkdir(exist_ok=True)
version = '.'.join(json.loads((root / 'package.json').read_text(encoding='utf-8'))['version'].split('.')[:2])

def archive(name, entries, prefix):
    target = output / name
    with ZipFile(target, 'w', ZIP_DEFLATED, compresslevel=6) as z:
        for entry in entries:
            p = root / entry
            files = sorted(p.rglob('*')) if p.is_dir() else [p]
            for f in files:
                if f.is_file():
                    z.write(f, str(Path(prefix) / f.relative_to(root)))
    with ZipFile(target) as z:
        assert z.testzip() is None
        assert not any('node_modules/' in n or '/work/' in n or '.venv' in n for n in z.namelist())
    return {'file': target.name, 'bytes': target.stat().st_size, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}

entries = ['index.html', 'app', 'vendor', 'desktop', 'scripts', 'tests', 'docs', 'README.md', 'package.json', 'package-lock.json', '.gitignore']
results = [archive(f'简历工作台-{version}-源码.zip', entries, '简历工作台-源码'), archive(f'简历工作台-{version}-网页版.zip', ['index.html', 'app', 'vendor', 'README.md', 'docs'], '简历工作台-网页版')]
(output / f'交付文件校验-{version}.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(results, ensure_ascii=False, indent=2))
