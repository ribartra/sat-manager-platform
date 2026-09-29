import json,re,sys
from fractions import Fraction
S=sys.argv[1]
db=json.load(open(f"{S}/db.json")); ex=json.load(open(f"{S}/expl.json")); ky=json.load(open(f"{S}/keys.json"))
SUP=str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹⁻","0123456789-")
def nm(s):
    s = s or ""
    for k, v in {"²": "^2", "³": "^3", "⁴": "^4", "⁵": "^5", "⁻": "^-", "¹": "^1", "⁰": "^0", "₁": "1", "₂": "2",
                 "ᵗ": "^t", "■": "", "−": "-", "–": "-", "—": "-", "×": "*", "·": "*", "÷": "/"}.items():
        s = s.replace(k, v)
    for _ in range(3):
        s = re.sub(r"\\d?frac\{([^{}]*)\}\{([^{}]*)\}", r"\1/\2", s)
    s = re.sub(r"\\sqrt\[3\]", "∛", s)
    for k, v in {"\\leq": "≤", "\\le": "≤", "\\geq": "≥", "\\ge": "≥", "\\neq": "≠", "\\circ": "", "\\sqrt": "√",
                 "\\pi": "π", "\\cdot": "*", "\\times": "*", "\\lt": "<", "\\gt": ">", "{,}": "", ",": "", "°": ""}.items():
        s = s.replace(k, v)
    s = re.sub(r"\\[a-zA-Z]+", "", s)
    s = re.sub(r"[$\\{}\s()^_]", "", s).lower()
    s = s.replace("and", "")
    return s
def num(v):
    v=v.strip().replace("−","-").replace(",","") 
    try:
        if "/" in v: a,b=v.split("/"); return Fraction(a.strip())/Fraction(b.strip())
        return Fraction(v)
    except Exception: return None
def keyset(v):
    if v is None: return None
    v=str(v).strip()
    if v.startswith("NUM:"): v=v[4:]
    v=re.sub(r"^\d+\.\s+","",v)
    if re.fullmatch(r"[ABCD]",v): return ("L",v)
    parts=[p for p in re.split(r"\s*(?:\||,| or |;)\s*",v) if p]
    ns=set()
    for p in parts:
        n=num(p)
        if n is None: return ("R",nm(v))
        ns.add(n)
    return ("N",frozenset(ns))
def stored(r):
    if r["type"]=="MC": return ("L",r["ca"].strip().upper())
    ns=set()
    for p in r["ca"].split("|"):
        n=num(p)
        if n is None: return ("R",nm(r["ca"]))
        ns.add(n)
    return ("N",frozenset(ns))
def same(a,b):
    if a is None or b is None: return None
    if a[0]!=b[0]: return False
    if a[0]=="N": return bool(a[1]&b[1]) and (a[1]<=b[1] or b[1]<=a[1])
    return a[1]==b[1]
def toks(s):
    s=(s or "").translate(SUP).replace("−","-")
    nums=set(re.findall(r"-?\d+(?:\.\d+)?",s))
    words=set(w for w in re.findall(r"[a-zA-Z]{4,}",s.lower()) if w not in {"what","which","value","following","equation","expression","equivalent","find","shown","graph","given","that","this","with","from","their","there","where","below","above","table","system","equations"})
    return nums,words
def sim(summary,text):
    n1,w1=toks(summary); n2,w2=toks(text)
    a=len(n1&n2)/len(n1) if n1 else None; b=len(w1&w2)/len(w1) if w1 else None
    vals=[x for x in (a,b) if x is not None]
    return round(sum(vals)/len(vals),2) if vals else None
exq={(int(t),q["module"],q["n"]):q for t,qs in ex.items() for q in qs}
bym={}
for r in db: bym.setdefault((r["t"],r["m"]),[]).append(r)
out=[]
for r in db:
    t,m,n=r["t"],r["m"],r["n"]; f=[]
    c=r["cands"][0]; cm="1" if str(c["ml"])=="1" else "2B"
    if c["qn"]!=n: f.append(f"order: candidate #{c['qn']} at position {n}")
    if cm!=m: f.append(f"module: candidate {c['ml']} in module {m}")
    kk=None
    k=ky.get(str(t),{}).get(m)
    if k and len(k["answers"])>=n: kk=keyset(k["answers"][n-1])
    e=exq.get((t,m,n)); ek=keyset(e["answer"]) if e and e["answer"] and not e["answer"].startswith("RAW") else None
    st=stored(r)
    sk=same(st,kk); se=same(st,ek)
    if sk is False: f.append(f"key: stored {r['ca']} != ANS KEY {k['answers'][n-1]}")
    if se is False: f.append(f"key: stored {r['ca']} != Explanations {e['answer']}")
    if kk and ek and same(kk,ek) is False: f.append(f"source_conflict: ANS KEY {k['answers'][n-1]} vs Explanations {e['answer']}")
    if kk is None and ek is None: f.append("no source key")
    if e and e["answer"] and e["answer"].startswith("NUM:") and r["type"]=="MC":
        # "Correct Answer: −9 is correct" style: map the value to its option letter
        val=keyset(e["answer"]); opts={o["label"]:o for o in r["options"]}; hit=[l for l,o in opts.items() if same(keyset(nm(o["text"])),val)]
        if len(hit)==1: ek=("L",hit[0]); f=[x for x in f if "Explanations" not in x]
    if r["type"]=="MC" and st[0]=="L" and ek and ek[0]=="N": f.append(f"type: stored MC but source numeric {e['answer']}")
    if r["type"]!="MC" and (kk and kk[0]=="L" or ek and ek[0]=="L"): f.append(f"type: stored {r['type']} but source letter")
    # options
    opts={o["label"]:o for o in r["options"]}
    if r["type"]=="MC" and e and e["vals"]:
        for L,v in e["vals"].items():
            vv=nm(re.split(r"\s{2,}| — | – ",v)[0])[:40]
            if not vv or len(vv)<1: continue
            ot=nm(opts.get(L,{}).get("text",""))
            if not ot:
                continue
            if vv==ot or (len(vv)>=6 and (vv in ot or ot in vv)): continue
            raw=opts.get(L,{}).get("text","")
            if len(re.findall(r"[a-zA-Z]{3,}",raw))>=4:  # prose option: explanations paraphrase it
                w1=set(re.findall(r"[a-z]{4,}",v.lower())); w2=set(re.findall(r"[a-z]{4,}",raw.lower()))
                if not w1 or len(w1&w2)/len(w1)>=0.4: continue
            other=[l for l,o in opts.items() if l!=L and nm(o["text"])==vv]
            if other: f.append(f"option_permutation: expl {L}={v[:40]!r} matches option {other}")
            else: f.append(f"option_mismatch: expl {L}={v[:40]!r} vs option {L}={opts.get(L,{}).get('text','')[:40]!r}")
    # stem
    text=(r["stem"] or "")+" "+(r["stimulus"] or "")+" "+" ".join(o["text"] for o in r["options"])
    s0=sim(e["summary"],text) if e else None
    if e and s0 is not None and s0<0.34:
        best=max(((sim(e["summary"],(o["stem"] or "")+" "+(o["stimulus"] or "")+" "+" ".join(x["text"] for x in o["options"])),o["n"]) for o in bym[(t,m)] if o["n"]!=n),default=(0,None))
        f.append(f"stem_low_match {s0}"+(f" (best match position {best[1]} = {best[0]})" if best[0] and best[0]>s0+0.25 else ""))
    out.append({"test":t,"module":m,"n":n,"qid":r["qid"],"type":r["type"],"stored":r["ca"],"ansKey":(k["answers"][n-1] if kk else None),"expl":(e["answer"] if e else None),"stemSim":s0,"page":c["page"],"flags":f,"summary":(e["summary"] if e else None),"stem":(r["stem"] or "")[:200],"options":{l:o["text"][:60] for l,o in opts.items()},"explVals":(e["vals"] if e else {})})
json.dump(out,open(f"{S}/result.json","w"),ensure_ascii=False,indent=1)
from collections import Counter
cnt=Counter(fl.split(":")[0].split(" ")[0] for o in out for fl in o["flags"])
print("flagged questions",sum(1 for o in out if o["flags"]),"/",len(out)); print(cnt)
for t in range(1,11):
    for m in ("1","2B"):
        qs=[o for o in out if o["test"]==t and o["module"]==m]
        print(f"T{t} M{m}: {sum(1 for o in qs if o['flags'])} flagged; keycheck ANS={sum(1 for o in qs if o['ansKey'] is not None)} EXPL={sum(1 for o in qs if o['expl'])}")
