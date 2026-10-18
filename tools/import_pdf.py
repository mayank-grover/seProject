"""Reproducible OCR adapter. Requires pdfplumber, Pillow, numpy and tesseract.
Source image cells are retained alongside normalized room events for review.
"""
import csv,json,re,collections,subprocess,concurrent.futures,sys,tempfile
import pdfplumber
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
BRANCHES={2:'M.Tech CSE · Semester 1',3:'B.Tech · Semester 1 · ES2301',4:'CSE AI · Semester 7',5:'CSE DS · Semester 7',6:'CSE · Semester 7',7:'CSE AI · Semester 5',8:'CSE DS · Semester 5',9:'CSE · Semester 5',10:'CSE AI · Semester 3',11:'CSE DS · Semester 3',12:'CSE · Semester 3'}
def centers(vals,gap=3):
 g=[]
 for x in vals:
  if not g or x>g[-1][-1]+gap:g.append([])
  g[-1].append(int(x))
 return [round(sum(z)/len(z)) for z in g]
def runs(a,n,axis):
 cs=np.cumsum(a,axis=axis,dtype=np.int32)
 z=np.zeros_like(a,dtype=bool)
 if axis==1:
  win=cs[:,n:]-cs[:,:-n];z[:,n//2:a.shape[1]-n+n//2]=win>n*.91
 else:
  win=cs[n:,:]-cs[:-n,:];z[n//2:a.shape[0]-n+n//2,:]=win>n*.91
 return z

if len(sys.argv)!=2: raise SystemExit('Usage: python tools/import_pdf.py /absolute/path/to/timetable.pdf')
# The adapter is specific to this scanned PEC October 2026 table layout.
work=Path(tempfile.mkdtemp(prefix='stillspace-ocr-'))
ROOT.mkdir(parents=True,exist_ok=True)
(ROOT/'data').mkdir(exist_ok=True)
(ROOT/'dist/assets').mkdir(parents=True,exist_ok=True)
with pdfplumber.open(sys.argv[1]) as pdf:
 if len(pdf.pages)!=12: raise ValueError('Expected the 12-page PEC source; review adapter for a different file.')
 for page in range(2,13):
  im=pdf.pages[page-1].to_image(resolution=180).original.rotate(-90,expand=True)
  im.save(work/f'tt-r-{page}.png')
  im.resize((1684,1190)).save(ROOT/f'dist/assets/source-{page}.webp',quality=83)
jobs=[]
for page in range(2,13):
 im=Image.open(work/f'tt-r-{page}.png').convert('L');a=np.array(im)<150
 ys=centers(np.where(a.sum(axis=1)>a.shape[1]*.65)[0]);top,header=ys[:2]
 xs=centers(np.where(a[top+7:header-7].mean(axis=0)>.7)[0]);days=centers(np.where(a[:,xs[0]+7:xs[1]-7].mean(axis=1)>.8)[0]);days=[y for y in days if y>=header-3]
 hm=runs(a,60,1);vm=runs(a,38,0)
 rects=set()
 subys=centers(np.where(hm[:,xs[1]:xs[-1]].sum(axis=1)>60)[0]);subys=sorted(set([y for y in subys if header-3<=y<=days[-1]+3]+days))
 for y0,y1 in zip(subys,subys[1:]):
  if y1-y0<25:continue
  y=(y0+y1)//2
  vx=centers(np.where(vm[max(header,y-5):y+6].mean(axis=0)>.4)[0]);vx=sorted(set([x for x in vx if xs[1]-5<x<xs[-1]+5]+[xs[1],xs[-1]]))
  for x0,x1 in zip(vx,vx[1:]):
   if x1-x0<35:continue
   x=(x0+x1)//2
   hy=centers(np.where(hm[:,max(0,x-4):x+5].mean(axis=1)>.35)[0]);hy=[v for v in hy if header-4<=v<=days[-1]+4]
   lo=max([v for v in hy if v<y] or [y0]);hi=min([v for v in hy if v>y] or [y1])
   rects.add((x0,lo,x1,hi))
 for j,(x0,y0,x1,y1) in enumerate(sorted(rects)):
  day=next((i+1 for i in range(5) if days[i]<=(y0+y1)/2<days[i+1]),None)
  if not day:continue
  slots=[i for i in range(len(xs)-2) if x0-6<(xs[i+1]+xs[i+2])/2<x1+6]
  if not slots:continue
  path=str(work/f'crop-{page}-{j}.png');im.crop((x0+5,y0+5,x1-4,y1-4)).resize(((x1-x0-9)*2,(y1-y0-9)*2)).save(path)
  jobs.append((page,j,day,slots,path))
def work(job):
 page,j,day,slots,path=job
 r=subprocess.run(['tesseract',path,'stdout','--psm','6'],capture_output=True,text=True)
 t=' '.join(r.stdout.split())
 if not re.search('[A-Za-z0-9]',t) or t.upper()=='LUNCH':return None
 return dict(page=page,branch=BRANCHES[page],day=day,start=(8+min(slots))*60,end=(19 if page==10 and max(slots)==9 else 9+max(slots))*60,text=t)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex: cells=[c for c in ex.map(work,jobs) if c]
(ROOT/'data/ocr-cells.json').write_text(json.dumps(cells,indent=2))
print('cells',len(cells),collections.Counter(c['page'] for c in cells))
