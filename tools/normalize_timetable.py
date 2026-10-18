"""Map OCR venue references conservatively. No inferred capacity/access data.
L405 and 405 alias; 3xx spaces, 402 and CL labs remain separate from Lxx.
Unlocated cells are retained as unresolved rather than treated as free rooms.
"""
import json,re,collections
from pathlib import Path
root=Path(__file__).resolve().parents[1]
raw_cells=json.loads((root/'data/ocr-cells.json').read_text())
# OCR grid fragments can yield the same cell twice; normalize idempotently.
cells=list({(c['page'],c['day'],c['start'],c['end'],c['text']):c for c in raw_cells}.values())
def rooms_for(raw):
 t=raw.upper().replace('€L','CL').replace('C114','CL14').replace('C113','CL13').replace('30S','305').replace('40S','405').replace('L4O','L40')
 rooms=set()
 # Expand explicit classroom ranges, including compact forms such as L26-29.
 for m in re.finditer(r'\bL\s*-?\s*(\d{2})\s*[-–—]\s*L?\s*(\d{2})\b',t):
  lo,hi=map(int,m.groups())
  if 10<=lo<=hi<=31: rooms.update('L'+str(n) for n in range(lo,hi+1))
 for m in re.finditer(r'\b(CL|L|T)\s*-?\s*(\d{1,3})\b',t):
  prefix,num=m.group(1),int(m.group(2))
  if prefix=='CL' and num in (5,13,14):rooms.add('CL'+str(num))
  if prefix=='L' and (10<=num<=31 or num in (405,406,407)):rooms.add('L'+str(num))
  if prefix=='T' and num in (9,11,12):rooms.add('T'+str(num))
 for m in re.finditer(r'(?<![A-Z0-9])(?:L)?(301|302|303|304|305|306|402|405|406|407)(?![A-Z0-9])',t):
  n=int(m.group(1));rooms.add(('L' if n>=405 else 'LAB')+str(n))
 if re.search(r'\bD[5S]\s*LAB\b',t):rooms.add('DS-LAB')
 if 'EE DEPT' in t:rooms.add('EE-CLASS')
 return sorted(rooms)
events=[];unresolved=[]
for i,c in enumerate(cells):
 rs=rooms_for(c['text']);row={**c,'id':f'ocr-{i+1:03}','rooms':rs,'review':'OCR · verify source'}
 if rs:events.append(row)
 else:unresolved.append(row)
ids=sorted(set(r for e in events for r in e['rooms']))
rooms=[]
for r in ids:
 lab=r.startswith(('LAB','CL')) or r=='DS-LAB'
 name=('Lab '+r[3:] if r.startswith('LAB') else 'DS Lab' if r=='DS-LAB' else 'EE Classroom' if r=='EE-CLASS' else r.replace('CL','CL ').replace('T','T-') if r.startswith(('CL','T')) else 'L '+r[1:])
 rooms.append(dict(id=r,name=name,type='lab' if lab else 'classroom',location='Electrical Engineering' if r=='EE-CLASS' else 'PEC · CSE schedule',capacity=None,floor=None,amenities=None,studyPermission=None))
data=dict(campus='Punjab Engineering College, Chandigarh',timezone='Asia/Kolkata',semester='2026-27-1',validFrom='2026-10-09',validTo='2026-12-31',coverage='Partial CSE departmental schedules; holidays and actual access unverified.',events=events,rooms=rooms,unresolved=unresolved,cellCount=len(cells),sources=[dict(page=p,title=next(c['branch'] for c in cells if c['page']==p),image=f'/assets/source-{p}.webp') for p in range(2,13)])
(root/'dist/data.json').write_text(json.dumps(data,indent=2))
(root/'data/normalized-timetable.json').write_text(json.dumps(data,indent=2))
print('Mapped events',len(events),'Rooms',len(rooms),'Unresolved',len(unresolved));print(ids)
