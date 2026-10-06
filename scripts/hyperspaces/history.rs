use loro::{ExportMode, LoroDoc, StyleConfig, ExpandType};
use serde_json::json;
use std::io::{self, Write};

struct Rng(u64);
impl Rng {
    fn next(&mut self, n: usize) -> usize {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        (self.0 % n as u64) as usize
    }
}
fn doc(peer: u64) -> LoroDoc {
    let d = LoroDoc::new();
    d.set_peer_id(peer).unwrap();
    d.set_record_timestamp(false);
    d.config_default_text_style(Some(StyleConfig { expand: ExpandType::After }));
    d
}
fn hex(bytes: Vec<u8>) -> String {
    const DIGITS: &[u8] = b"0123456789abcdef";
    let mut out = Vec::with_capacity(bytes.len() * 2);
    for byte in bytes { out.push(DIGITS[(byte >> 4) as usize]); out.push(DIGITS[(byte & 15) as usize]); }
    String::from_utf8(out).unwrap()
}
fn emit(d: &LoroDoc, seed: usize, step: usize, replica: usize) {
    d.commit();
    let row = json!({
        "seed": seed, "step": step, "replica": replica,
        "text": d.get_text("body").to_string(),
        "value": d.get_deep_value(),
        "delta": d.get_text("body").to_delta(),
        "snapshot": hex(d.export(ExportMode::Snapshot).unwrap()),
        "updates": hex(d.export(ExportMode::all_updates()).unwrap()),
        "oplog_vv": hex(d.oplog_vv().encode()),
        "state_vv": hex(d.state_vv().encode()),
        "frontiers": hex(d.state_frontiers().encode()),
    });
    let stdout = io::stdout();
    let mut out = stdout.lock();
    serde_json::to_writer(&mut out, &row).unwrap();
    writeln!(out).unwrap();
}
fn main() {
    let a: Vec<String> = std::env::args().collect();
    let seeds = a.get(1).map(|v| v.parse().unwrap()).unwrap_or(1000);
    let steps = a.get(2).map(|v| v.parse().unwrap()).unwrap_or(200);
    for seed in 1..=seeds {
        let mut rng = Rng(seed as u64);
        let base = doc(500);
        let corpus = ["a", "é", "😀", "\n", "e\u{301}", "中"];
        let initial = corpus[rng.next(corpus.len())].repeat([1, 255, 256, 257, 4096, 16384][rng.next(6)]);
        base.get_text("body").insert(0, &initial).unwrap();
        base.commit();
        let start = base.export(ExportMode::Snapshot).unwrap();
        let docs: Vec<_> = (1..=4).map(|peer| { let d = doc(peer); d.import(&start).unwrap(); d }).collect();
        let mut queued = Vec::new();
        let mut cuts = vec![base.state_frontiers()];
        for step in 0..steps {
            let i = rng.next(4);
            let d = &docs[i];
            let text = d.get_text("body");
            let n = text.len_unicode();
            match rng.next(12) {
                0..=3 => {
                    let at = rng.next(n + 1);
                    let value = corpus[rng.next(corpus.len())].repeat([1, 2, 7, 255, 257, 4096][rng.next(6)]);
                    text.insert(at, &value).unwrap();
                }
                4 | 5 if n > 0 => {
                    let at = rng.next(n);
                    let len = (1 + rng.next(512)).min(n - at);
                    text.delete(at, len).unwrap();
                }
                6 if n > 0 => {
                    let at = rng.next(n); let end = (at + 1 + rng.next(512)).min(n);
                    if rng.next(2) == 0 { text.mark(at..end, "bold", true).unwrap(); }
                    else { text.unmark(at..end, "bold").unwrap(); }
                }
                7 => { d.get_map("meta").insert(&format!("k{}", rng.next(8)), step as i64).unwrap(); }
                8 => {
                    let list = d.get_list("list");
                    if list.len() > 0 && rng.next(2) == 0 { list.delete(rng.next(list.len()), 1).unwrap(); }
                    else { list.insert(rng.next(list.len() + 1), step as i64).unwrap(); }
                }
                9 => {
                    let j = rng.next(4);
                    let bytes = docs[j].export(ExportMode::updates(&d.oplog_vv())).unwrap();
                    if rng.next(3) == 0 { queued.push((i, bytes)); }
                    else { d.import(&bytes).unwrap(); d.import(&bytes).unwrap(); }
                }
                10 if !queued.is_empty() => { let (j, bytes) = queued.remove(rng.next(queued.len())); docs[j].import(&bytes).unwrap(); }
                _ => {
                    d.commit();
                    let cut = &cuts[rng.next(cuts.len())];
                    // Saved cuts may be from an unsynced replica: checkout refuses them.
                    if d.checkout(cut).is_ok() { emit(d, seed, step, i); }
                    d.checkout_to_latest();
                }
            }
            d.commit();
            if step % 23 == 0 {
                cuts.push(d.state_frontiers());
                for (j, other) in docs.iter().enumerate() { emit(other, seed, step, j); }
                let reloaded = doc(700);
                reloaded.import(&d.export(ExportMode::Snapshot).unwrap()).unwrap();
                emit(&reloaded, seed, step, 4);
            }
        }
        for (i, bytes) in queued { docs[i].import(&bytes).unwrap(); }
        let all: Vec<_> = docs.iter().map(|d| d.export(ExportMode::all_updates()).unwrap()).collect();
        for (i, d) in docs.iter().enumerate() {
            for bytes in all.iter().rev() { d.import(bytes).unwrap(); }
            for bytes in &all { d.import(bytes).unwrap(); }
            emit(d, seed, steps, i);
        }
        for d in &docs[1..] { assert_eq!(docs[0].get_deep_value(), d.get_deep_value()); }
    }
}
