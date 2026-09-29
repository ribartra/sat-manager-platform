import re,json,sys
LET=r"[ABCD]"
def norm_mod(s):
    s=s.upper()
    if re.search(r"MODULE\s*2",s): return "2B"
    if re.search(r"2\s*A\b",s): return "2A"
    if re.search(r"2\s*B\b|MODULE 2\b|MODULE 2 ",s): return "2B" if "2A" not in s else "2A"
    if re.search(r"MODULE 1\b",s): return "1"
    return None
HDR=re.compile(r"^(?:\[T\]\s*)?(?:Question\s*(\d{1,2})\b[:.]?|Q(\d{1,2})\b[.:]?)\s*(.*)$",re.I)
def parse(t):
    lines=open(f"{sys.argv[1]}/expl-{t}.txt").read().split("\n")
    mod=None;qs=[];cur=None
    for l in lines:
        raw=l[4:] if l.startswith("[T] ") else l
        if re.match(r"^(MATH\s+)?MODULE\s+\d",raw.strip(),re.I) and len(raw)<70:
            m=norm_mod(raw); 
            if m: mod=m; continue
        h=HDR.match(l)
        if h and (h.group(1) or h.group(2)):
            n=int(h.group(1) or h.group(2))
            cur={"module":mod,"n":n,"summary":h.group(3).strip(),"body":[]};qs.append(cur);continue
        if cur: cur["body"].append(l)
    out=[]
    for q in qs:
        body=q["body"];txt="\n".join(body);ans=None;val=None;vals={}
        full=q["summary"]+"\n"+txt
        mCA=re.search(r"Correct Answer:\s*Choice\s*([ABCD])",full)
        m=re.search(r"Correct Answer:\s*("+LET+r")\b\s*(?:[—–-]\s*([^\n⏎]{1,80}))?",full) or re.search(r"Answer:\s*("+LET+r")\s*[:—–-]\s*([^\n⏎]{1,80})",full)
        if mCA: ans=mCA.group(1)
        elif m: ans=m.group(1); val=(m.group(2) or "").strip() or None
        else:
            m=re.search(r"Correct Answer:\s*([^\n⏎]{1,40})",full) or re.search(r"Answer:\s*([^\n⏎\[]{1,40})",q["summary"])
            if m:
                a=m.group(1).strip(); mm=re.match(r"^(-?[\d./,|\s√π−-]+|[\d.]+\s*or\s*[\d./]+)(?=\s|$)",a.replace("−","-"))
                ans=("NUM:"+mm.group(1).strip()) if mm else "RAW:"+a
        if ans is None:
            for i,b in enumerate(body):
                mm=re.match(r"^\[T\]\s*✓\s*("+LET+r")\s*$",b)
                if mm: ans=mm.group(1); val=body[i+1][4:].strip() if i+1<len(body) and body[i+1].startswith("[T]") else None; break
        if ans is None or ans.startswith("RAW:"):
            mm=re.match(r"^RAW:("+LET+r")\s*$",ans or "")
            if mm: ans=mm.group(1)
        if ans is None:
            for i,b in enumerate(body[:-1]):
                if b.strip()=="[T] Solution" and i>0 and body[i-1].strip()=="[T] Answer":
                    v=body[i+1][4:].strip()
                    ans=(v if re.fullmatch(LET,v) else "NUM:"+v); break
        if ans is None:
            m=re.search(r"Choice\s+("+LET+r")\s+(?:\([^)]*\)\s+)?is\s+(?:the\s+)?(?:best|correct)",full)
            if m: ans=m.group(1)
        if ans is None:
            m=re.search(r"correct answer is\s*("+LET+r")\b",full,re.I)
            if m: ans=m.group(1)
        # per-letter values
        for i,b in enumerate(body):
            mm=re.match(r"^\[T\]\s*[✓✗]\s*("+LET+r")\s*$",b)
            if mm and i+1<len(body): vals[mm.group(1)]=body[i+1][4:].strip()
            mm=re.match(r"^\[T\]\s*\(("+LET+r")\)\s*$",b)
            if mm and i+1<len(body): vals[mm.group(1)]=re.split(r"\s+—\s+",body[i+1][4:].strip())[0]
            mm=re.match(r"^\[T\]\s*\(("+LET+r")\)\s+(.+?)\s{2,}",b)
            if mm: vals[mm.group(1)]=mm.group(2)
        for mm in re.finditer(r"(?:^|⏎|\n|\s)("+LET+r")\s+—\s+([^:⏎\n]{1,60}):",full):
            vals.setdefault(mm.group(1),mm.group(2).strip())
        for mm in re.finditer(r"Choice\s+("+LET+r")\s+\(([^)]{1,60})\)",full):
            vals.setdefault(mm.group(1),mm.group(2).strip())
        if ans and len(ans)==1 and val: vals.setdefault(ans,val)
        out.append({"module":q["module"],"n":q["n"],"summary":q["summary"][:200],"answer":ans,"vals":vals,"text":full[:1500]})
    return out
import os
res={t:parse(t) for t in range(1,11) if os.path.exists(f'{sys.argv[1]}/expl-{t}.txt')}
json.dump(res,open(f"{sys.argv[1]}/expl.json","w"),ensure_ascii=False)
for t,qs in res.items():
    from collections import Counter
    c=Counter(q["module"] for q in qs)
    noans=[(q["module"],q["n"]) for q in qs if not q["answer"] or q["answer"].startswith("RAW")]
    nov=sum(1 for q in qs if q["answer"] and len(q["answer"])==1 and len(q["vals"])<4)
    print(t,dict(c),"noans",len(noans),noans[:6],"MC<4vals",nov)
