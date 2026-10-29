import json,sys
def score(p):
    R=[json.loads(l) for l in open(p)]; A=[r for r in R if not r["is_abs"]]; B=[r for r in R if r["is_abs"]]
    return dict(n=len(R),acc=sum(r["label"] for r in R),ans_acc=sum(r["label"] for r in A),n_ans=len(A),abs_ok=sum(r["label"] for r in B),abs_abst=sum(r["abstained"] for r in B),n_abs=len(B),
      false_abst=sum(r["abstained"] for r in A),gate=sum(r["abstained_by"]=="evidence-gate" for r in A),overrides=sum(bool(r.get("judge_override")) for r in R),trunc=sum(bool(r.get("truncation_retries")) for r in R))
for p in sys.argv[1:]: print(p.split("/")[-2], json.dumps(score(p)))
