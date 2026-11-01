import docx,re,json,sys
keys={1:"TEST 1/MATH/Answers Test 1 Innovator CHECKED.docx",3:"TEST 3/ANS Key Test 3.docx",4:"TEST 4/ TEST 4 ANS KEY.docx",5:"TEST 5/ANSWERS KEY TEST 5.docx",6:"TEST 6/TEST 6 ANS KEY.docx",7:"TEST 7/TEST 7 ANS KEY.docx",9:"TEST 9/Test 9 Ans Key.docx",10:"TEST 10/ TEST 10 ANS KEY.docx",101:"TEST 1/Answers Key Test 1_.docx"}
out={}
for t,f in keys.items():
    d=docx.Document(f);res={}
    for tb in d.tables:
        rows=[[c.text.strip() for c in r.cells] for r in tb.rows]
        ncol=max(len(r) for r in rows)
        for ci in range(ncol):
            col=[r[ci] if ci<len(r) else "" for r in rows]
            head=next((c for c in col if re.search(r"math",c,re.I)),None)
            if not head: continue
            body="\n".join(c for c in col if c!=head)
            m="1" if re.search(r"\b1\b",head) and not re.search(r"2",head) else ("2A" if re.search(r"2\s*A",head,re.I) else "2B")
            items=body.split("\n"); main=[];extra=[];inx=False
            for it in items:
                it=it.strip()
                if not it: continue
                if re.match(r"extra",it,re.I): inx=True; continue
                (extra if inx else main).append(it)
            res.setdefault(m,{"head":head,"answers":main,"extra":extra})
    out[t]=res
    print(t,{m:(v["head"].replace("\n"," "),len(v["answers"]),v["extra"]) for m,v in res.items()})
json.dump(out,open(sys.argv[1]+"/keys.json","w"),ensure_ascii=False)
