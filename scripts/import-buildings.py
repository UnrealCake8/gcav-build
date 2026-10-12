#!/usr/bin/env python3
"""Extract actual building outlines and streets from cached OSM map API JSON.
Usage: python scripts/import-buildings.py AREA.json [AREA2.json ...]
Coordinates remain WGS84. Height fallback is explicit; layer is never elevation.
"""
import json,sys,time,re
from pathlib import Path
root=Path(__file__).resolve().parents[1];elements={}
for file in sys.argv[1:]:
 for e in json.loads(Path(file).read_text())['elements']:elements[(e['type'],e['id'])]=e
nodes={i:e for (kind,i),e in elements.items() if kind=='node'};buildings=[];streets=[]
def number(s):
 try:return float(str(s).split()[0])
 except:return None
for (kind,id),e in elements.items():
 if kind!='way':continue
 t=e.get('tags',{});ids=e.get('nodes',[])
 if not ids or any(i not in nodes for i in ids):continue
 coords=[[nodes[i]['lon'],nodes[i]['lat']] for i in ids]
 if t.get('building') and t['building']!='no' and len(coords)>=4 and ids[0]==ids[-1]:
  h=number(t.get('height'));levels=number(t.get('building:levels'));source='height' if h else 'levels' if levels else 'fallback'
  buildings.append({'id':id,'name':t.get('name:en',t.get('name','')),'kind':t['building'],'height':h or levels and levels*3.2 or 10,'heightSource':source,'coordinates':coords})
 if t.get('highway') in ['primary','secondary','tertiary','residential','service','unclassified','motorway_link','trunk_link','primary_link','secondary_link','tertiary_link'] and len(coords)>1 and t.get('indoor')!='yes' and t.get('level','0')=='0':
  streets.append({'id':id,'name':t.get('name:en',t.get('name','Local street')),'ref':t.get('ref','LOCAL'),'highway':t['highway'],'lanes':int(number(t.get('lanes')) or 2),'bridge':t.get('bridge')=='yes','layer':t.get('layer','0'),'coordinates':coords})
payload={'source':'OpenStreetMap contributors','license':'ODbL-1.0','retrieved':time.strftime('%Y-%m-%d'),'note':'Partial Downtown and Al Barsha map API extracts. Missing heights use explicit estimates; no road elevation measurements.','buildings':buildings,'streets':streets}
(root/'src/data/dubai-buildings.json').write_text(json.dumps(payload,separators=(',',':'))+'\n');print(f'{len(buildings)} footprints and {len(streets)} streets')
