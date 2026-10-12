# テスト用の動画：30m四方のフロア（中に20mの四角・中央の線）と、赤い上着・紺のズボンの12人。カメラは客席の高い所から
import numpy as np, cv2, json, subprocess, os
W,H=640,360; FPS=10; DUR=4.0
f=560.0; cx,cy=W/2,H/2
C=np.array([0.0,-32.0,15.0])          # カメラの位置（フロアの中心から手前42m・高さ13m）
look=np.array([0.0,2.0,0.0]); fwd=look-C; fwd/=np.linalg.norm(fwd)
right=np.cross(fwd,[0,0,1.0]); right/=np.linalg.norm(right); up=np.cross(right,fwd)
R=np.vstack([right,-up,fwd])           # 世界→カメラ（x右・y下・z前）
def proj(P):
    P=np.atleast_2d(P).astype(float); q=(P-C)@R.T; return np.c_[f*q[:,0]/q[:,2]+cx, f*q[:,1]/q[:,2]+cy]
def people(t):
    # 3行×4列のブロック。2秒目から2秒かけて右へ2m動く
    dx=0 if t<2 else min(2.0,(t-2)/2*2.0)
    return [(-6+c*4+dx, 6-r*4) for r in range(3) for c in range(4)]
segs=[]
def box(h): segs.extend([((-h,h),(h,h)),((h,h),(h,-h)),((h,-h),(-h,-h)),((-h,-h),(-h,h))])
box(15); box(10); segs.extend([((0,-15),(0,15)),((-15,0),(15,0))])
os.makedirs('fr',exist_ok=True)
n=int(DUR*FPS)
for k in range(n):
    t=k/FPS; im=np.full((H,W,3),(40,35,35),np.uint8)
    fl=proj([(-19,19,0),(19,19,0),(19,-19,0),(-19,-19,0)]).astype(np.int32); cv2.fillPoly(im,[fl],(150,135,120))
    for a,b in segs:
        p=proj([(a[0],a[1],0),(b[0],b[1],0)]); cv2.line(im,tuple(np.round(p[0]).astype(int)),tuple(np.round(p[1]).astype(int)),(235,235,235),2,cv2.LINE_AA)
    ps=sorted(people(t),key=lambda q:-q[1])   # 奥から描く
    for (x,y) in ps:
        l=proj([(x-0.15,y,0.05),(x+0.15,y,0.85)]); tr=proj([(x-0.22,y,0.9),(x+0.22,y,1.45)]); hd=proj([(x,y,1.6)])[0]
        cv2.rectangle(im,tuple(np.round(l[0]).astype(int)),tuple(np.round(l[1]).astype(int)),(60,30,25),-1)
        cv2.rectangle(im,tuple(np.round(tr[0]).astype(int)),tuple(np.round(tr[1]).astype(int)),(40,40,200),-1)
        cv2.circle(im,tuple(np.round(hd).astype(int)),max(2,int(0.12*f/np.linalg.norm(np.array([x,y,1.6])-C))),(80,120,170),-1)
    cv2.imwrite('fr/%04d.png'%k,im)
corners=proj([(-15,15,0),(15,15,0),(15,-15,0),(-15,-15,0)]).round(2).tolist()
json.dump({'corners':corners,'W':W,'H':H,'people0':people(0),'people4':people(4)},open('truth.json','w'))
subprocess.run(['ffmpeg','-v','error','-y','-framerate',str(FPS),'-i','fr/%04d.png','-c:v','libvpx','-b:v','800k','-pix_fmt','yuv420p','floor_test.webm'],check=True)
print(corners)
