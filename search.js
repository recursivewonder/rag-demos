// Shared retrieval helpers for the demos: a real BM25 over CORPUS text, semantic ranking from
// the precomputed scores, Reciprocal Rank Fusion, short labels. All in the browser, no requests.
window.Search = (() => {
  const STOP = new Set(('a an the and or of to for in on at is are was were be been by with from that this these it its as do does did ' +
    'we our us you your i me my what which who how why when where there their than then if not no so can has have had will would ' +
    'should could any all about into after before more most only also just still again hey thing').split(' '));

  // Light stemmer: enough that "dropped" meets "drop" and "logs" meets "log". Tokens with digits stay whole.
  function stem(t) {
    if (/\d/.test(t) || t.length <= 3) return t;
    t = t.replace(/(ing|ed|es|s)$/, '');
    if (t.length > 3) t = t.replace(/e$/, '');
    return t.replace(/([b-df-hj-np-tv-z])\1$/, '$1');
  }
  // Keeps IDs like 7f3a-91c2, KI-014 and re-queue whole; keeps "vendor A" as one term (vendora).
  function tokens(s) {
    s = String(s).toLowerCase().replace(/\bvendors ([abc]) and ([abc])\b/g, 'vendor vendor$1 vendor$2').replace(/\bvendors? ([abc])\b/g, 'vendor vendor$1');
    return (s.match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) || []).filter(t => !STOP.has(t)).map(stem);
  }

  const docs = window.CORPUS.map(c => ({ id: c.id, toks: tokens(c.text) }));
  const N = docs.length, avgdl = docs.reduce((s, d) => s + d.toks.length, 0) / N;
  const df = {};
  docs.forEach(d => new Set(d.toks).forEach(t => { df[t] = (df[t] || 0) + 1; }));
  const idf = t => Math.log((N - (df[t] || 0) + 0.5) / ((df[t] || 0) + 0.5) + 1);

  function bm25(text, k1 = 1.2, b = 0.75) {
    const q = [...new Set(tokens(text))];
    return docs.map(d => {
      let s = 0;
      q.forEach(t => {
        const tf = d.toks.filter(x => x === t).length;
        if (tf) s += idf(t) * tf * (k1 + 1) / (tf + k1 * (1 - b + b * d.toks.length / avgdl));
      });
      return { id: d.id, score: s };
    });
  }
  // Ranked lists. `ids` = the candidate set after filters.
  function keyword(text, ids) {
    const keep = new Set(ids);
    return bm25(text).filter(r => keep.has(r.id) && r.score > 0).sort((a, b) => b.score - a.score);
  }
  function semantic(qid, ids) {
    return ids.map(id => ({ id, score: window.semanticScore(qid, id) })).sort((a, b) => b.score - a.score);
  }
  // Weighted RRF: each list contributes w / (60 + rank).
  function rrf(lists, weights) {
    const acc = {};
    lists.forEach((l, i) => l.forEach((r, k) => { acc[r.id] = (acc[r.id] || 0) + weights[i] / (60 + k + 1); }));
    return Object.entries(acc).map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
  }
  function short(c) {
    if (typeof c === 'string') c = window.CORPUS.find(x => x.id === c);
    const s = c.src;
    if (c.type === 'ki') return s.match(/KI-\d+/)[0];
    if (c.type === 'minutes') return 'minutes ' + c.date.slice(5) + ' ' + (s.split('§')[1] || '');
    if (c.type === 'mail') return 'mail ' + c.date.slice(5) + (c.untrusted ? ' fwd transcript' : /quoted/.test(s) ? ' quoted' : ' vendor A');
    if (c.type === 'sop' || c.type === 'design' || c.type === 'policy') return s.split(' ')[0] + ' §' + (s.split('§')[1] || '').split(' ')[0];
    if (c.type === 'log') return 'transfer.log ' + s.split(' ').pop();
    if (c.type === 'config') return 'cleanup config';
    if (c.type === 'onedrive') return "Priya's OneDrive note";
    if (c.type === 'jira') return 'POC-12 snapshot';
    if (c.type === 'ticket') return 'TCK-4471';
    return s;
  }
  // Relevance for highlighting: GOLDEN plus a few extra judgements for the other preset questions.
  const EXTRA = { q3: { c21: 3, c16: 2 }, q4: { c20: 3, c30: 3, c25: 2 }, q6: { c17: 3, c18: 3 }, q7: { c29: 3, c05: 1 } };
  const rel = qid => (window.GOLDEN[qid] || EXTRA[qid] || {});
  return { tokens, bm25, keyword, semantic, rrf, short, rel };
})();
