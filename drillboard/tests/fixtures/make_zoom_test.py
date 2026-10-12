# テスト用の動画（定点カメラ・ズームあり）：30m四方のフロア（中に20mの四角・中央の線）と12人。客席に見立てた模様あり。
# カメラは動かさず、1秒目から2.5秒目にかけて 2.2倍にズームする（画面の中心が軸）。人は2秒目から2秒かけて右へ2m
import numpy as np, cv2, json, subprocess, os
W,H=640,360; FPS=10; DUR=4.0
cx,cy=W/2,H/2
C=np.array([0.0,-32.0,15.0]); look=np.array([0.0,2.0,0.0]); fwd=look-C; fwd/=np.linalg.norm(fwd)
right=np.cross(fwd,[0,0,1.0]); right/=np.linalg.norm(right); up=np.cross(right,fwd); R=np.vstack([right,-up,fwd])
def focal(t): return 560.0*(1+1.2*min(1,max(0,(t-1.0)/1.5)))
def proj(P,f):
    P=np.atleast_2d(P).astype(float); q=(P-C)@R.T; return np.c_[f*q[:,0]/q[:,2]+cx, f*q[:,1]/q[:,2]+cy]
def people(t):
    dx=0 if t<2 else min(2.0,(t-2)/2*2.0)
    return [(-6+c*4+dx, 6-r*4) for r in range(3) for c in range(4)]
segs=[]
def box(h): segs.extend([((-h,h),(h,h)),((h,h),(h,-h)),((h,-h),(-h,-h)),((-h,-h),(-h,h))])
box(15); box(10); segs.extend([((0,-15),(0,15)),((-15,0),(15,0))])
rng=np.random.default_rng(7)
# 客席：フロアの奥（y=19〜40、高さ0〜12mの斜面）に色のちがう四角をたくさん
seats=[(rng.uniform(-40,40), rng.uniform(19,40), rng.uniform(0.5,1.5), (int(rng.integers(60,220)), int(rng.integers(60,200)), int(rng.integers(30,120)))) for _ in range(900)]
os.makedirs('fr',exist_ok=True); n=int(DUR*FPS); truth=[]
for k in range(n):
    t=k/FPS; f=focal(t); im=np.full((H,W,3),(40,35,35),np.uint8)
    for (x,y,sz,col) in seats:
        z=(y-19)*0.55; p=proj([(x-sz/2,y,z),(x+sz/2,y,z+sz)],f)
        a=np.round(p.min(0)).astype(int); b=np.round(p.max(0)).astype(int); cv2.rectangle(im,tuple(a),tuple(b),col,-1)
    fl=proj([(-19,19,0),(19,19,0),(19,-19,0),(-19,-19,0)],f).astype(np.int32); cv2.fillPoly(im,[fl],(150,135,120))
    for a,b in segs:
        p=proj([(a[0],a[1],0),(b[0],b[1],0)],f); cv2.line(im,tuple(np.round(p[0]).astype(int)),tuple(np.round(p[1]).astype(int)),(235,235,235),max(2,int(2*f/560)),cv2.LINE_AA)
    ps=sorted(people(t),key=lambda q:-q[1])
    for (x,y) in ps:
        l=proj([(x-0.15,y,0.05),(x+0.15,y,0.85)],f); tr=proj([(x-0.22,y,0.9),(x+0.22,y,1.45)],f); hd=proj([(x,y,1.6)],f)[0]
        cv2.rectangle(im,tuple(np.round(l[0]).astype(int)),tuple(np.round(l[1]).astype(int)),(60,30,25),-1)
        cv2.rectangle(im,tuple(np.round(tr[0]).astype(int)),tuple(np.round(tr[1]).astype(int)),(40,40,200),-1)
        cv2.circle(im,tuple(np.round(hd).astype(int)),max(2,int(0.12*f/np.linalg.norm(np.array([x,y,1.6])-C))),(80,120,170),-1)
    cv2.imwrite('fr/%04d.png'%k,im)
    truth.append({'t':t,'f':f,'outer':proj([(-15,15,0),(15,15,0),(15,-15,0),(-15,-15,0)],f).round(2).tolist(),'inner':proj([(-10,10,0),(10,10,0),(10,-10,0),(-10,-10,0)],f).round(2).tolist(),'people':people(t)})
json.dump({'W':W,'H':H,'fps':FPS,'frames':truth},open('zoom_test.json','w'))
subprocess.run(['ffmpeg','-v','error','-y','-framerate',str(FPS),'-i','fr/%04d.png','-c:v','libvpx','-b:v','1500k','-pix_fmt','yuv420p','zoom_test.webm'],check=True)
print(truth[5]['inner'], truth[-1]['inner'])
