"""Download Overture Maps features for the configured bbox into data_cache/overture/*.parquet.

Overture is read anonymously from the public AWS bucket (s3://overturemaps-us-west-2).
Row-group bbox statistics are used so only intersecting row groups are transferred.
Re-running is idempotent: existing outputs are skipped unless --force.
"""
import os, sys, time, json, argparse
from urllib.parse import urlparse
import pyarrow.fs as pfs, pyarrow.dataset as ds, pyarrow.compute as pc, pyarrow.parquet as pq
sys.path.insert(0, os.path.dirname(__file__))
from world import cfg, ROOT

LAYERS = {
    'building': ('buildings', 'building'),
    'building_part': ('buildings', 'building_part'),
    'segment': ('transportation', 'segment'),
    'connector': ('transportation', 'connector'),
    'water': ('base', 'water'),
    'land_use': ('base', 'land_use'),
    'land': ('base', 'land'),
    'land_cover': ('base', 'land_cover'),
    'infrastructure': ('base', 'infrastructure'),
    'place': ('places', 'place'),
    'division_area': ('divisions', 'division_area'),
}


def s3():
    kw = dict(anonymous=True, region='us-west-2')
    px = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
    if px:
        p = urlparse(px)
        kw['proxy_options'] = {'scheme': p.scheme, 'host': p.hostname, 'port': p.port}
    return pfs.S3FileSystem(**kw)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--force', action='store_true'); ap.add_argument('layers', nargs='*')
    a = ap.parse_args()
    c = cfg(); rel = c['overture_release']; bb = c['fetch_bbox_wgs84']
    out = os.path.join(ROOT, 'data_cache', 'overture'); os.makedirs(out, exist_ok=True)
    fs = s3(); meta = {}
    for name in (a.layers or LAYERS):
        theme, typ = LAYERS[name]
        dst = os.path.join(out, f'{name}.parquet')
        if os.path.exists(dst) and not a.force:
            print('skip', name); continue
        t = time.time()
        d = ds.dataset(f'overturemaps-us-west-2/release/{rel}/theme={theme}/type={typ}/', filesystem=fs, format='parquet')
        f = ((pc.field('bbox', 'xmin') < bb[2]) & (pc.field('bbox', 'xmax') > bb[0]) &
             (pc.field('bbox', 'ymin') < bb[3]) & (pc.field('bbox', 'ymax') > bb[1]))
        tb = d.to_table(filter=f)
        pq.write_table(tb, dst)
        print(f'{name}: {tb.num_rows} rows in {time.time()-t:.1f}s', flush=True)
        meta[name] = {'rows': tb.num_rows, 'source': f's3://overturemaps-us-west-2/release/{rel}/theme={theme}/type={typ}/',
                      'retrieved_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
    mp = os.path.join(out, 'fetch_meta.json')
    old = json.load(open(mp)) if os.path.exists(mp) else {}
    old.update(meta); json.dump(old, open(mp, 'w'), indent=2)


if __name__ == '__main__':
    main()
