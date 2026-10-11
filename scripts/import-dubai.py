#!/usr/bin/env python3
"""Refresh the OSM snapshot, or reproduce it from raw Overpass/node JSON files."""
import argparse,json,urllib.request,urllib.parse,time
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--roads-json');parser.add_argument('--nodes-json');args=parser.parse_args();root=Path(__file__).resolve().parents[1]
def fetch(url):
 req=urllib.request.Request(url,headers={'User-Agent':'GCAV-map-development/1.0'})
 with urllib.request.urlopen(req,timeout=60) as res:return json.load(res)
query='[out:json][timeout:45];way[highway~"^(motorway|trunk)$"](25.11,55.18,25.24,55.36);out geom;'
raw=json.loads(Path(args.roads_json).read_text()) if args.roads_json else fetch('https://overpass-api.de/api/interpreter?'+urllib.parse.urlencode({'data':query}))
ways=[];ids=set()
for e in raw['elements']:
 if e['type']!='way':continue
 t=e.get('tags',{});ref=t.get('ref','')
 if ref not in ['E11','D68','E44','E66','D71','D75','D83','D79','E311']:continue
 if ref in ['E11','D68','E44']:ids.update(e.get('nodes',[]))
 pieces=[];current=[]
 for pt in e.get('geometry',[]):
  if not (25.08<=pt['lat']<=25.26 and 55.15<=pt['lon']<=55.39):
   if len(current)>1:pieces.append(current)
   current=[];continue
  current.append([pt['lon'],pt['lat']])
 if len(current)>1:pieces.append(current)
 try:lanes=min(8,max(1,int(t.get('lanes','3').split(';')[0])))
 except ValueError:lanes=3
 for coords in pieces:ways.append({'id':e['id'],'name':t.get('name:en',t.get('name',ref)),'ref':ref,'lanes':lanes,'maxspeed':t.get('maxspeed',''),'oneway':t.get('oneway')=='yes','bridge':t.get('bridge')=='yes','layer':t.get('layer','0'),'coordinates':coords})
if not ways:raise RuntimeError('No road geometry; existing snapshot left unchanged')
if args.nodes_json:nodes=json.loads(Path(args.nodes_json).read_text())['elements']
else:
 nodes=[];ordered=sorted(ids)
 for i in range(0,len(ordered),350):
  nodes+=fetch('https://api.openstreetmap.org/api/0.6/nodes.json?nodes='+','.join(map(str,ordered[i:i+350])))['elements'];time.sleep(.5)
gates=[]
for n in nodes:
 if n.get('tags',{}).get('highway')!='toll_gantry':continue
 name=n['tags'].get('name:en','Salik').replace(' Toll Gate','').replace(' Salik','');original=name
 if n['id']==1061530398:name='Al Safa North'
 gates.append({'id':str(n['id']),'name':name,'osmName':original,'logicalId':name.lower().replace(' ','-'),'group':'safa' if 'Safa' in name else None,'lon':n['lon'],'lat':n['lat']})
if not gates:raise RuntimeError('No gates; existing snapshot left unchanged')
retrieved=time.strftime('%Y-%m-%d',time.gmtime());data={'source':'OpenStreetMap contributors','license':'ODbL-1.0','attribution':'https://www.openstreetmap.org/copyright','retrieved':retrieved,'osmTimestamp':raw['osm3s']['timestamp_osm_base'],'queryBounds':[55.18,25.11,55.36,25.24],'projection':{'origin':[55.2744,25.1972],'horizontalScale':0.25},'roads':ways}
for file,payload in [('dubai-roads.json',data),('dubai-gates.json',{'source':'OpenStreetMap contributors','license':'ODbL-1.0','retrieved':retrieved,'gates':gates})]:
 target=root/'src/data'/file;target.parent.mkdir(exist_ok=True);temp=target.with_suffix('.tmp');temp.write_text(json.dumps(payload,separators=(',',':'))+'\n');temp.replace(target)
print(f'Saved {len(ways)} road pieces and {len(gates)} gantry nodes. Review changed geography and gate labels before rebuilding.')
