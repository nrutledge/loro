// HyperSpaces regression tests for duplicate final-leaf remapping (HYP-310).
use loro::{ExportMode, LoroDoc};

#[test]
fn concurrent_insert_into_one_large_leaf_preserves_further_edits() {
    let base = LoroDoc::new();
    base.set_peer_id(500).unwrap();
    base.get_text("body").insert(0, &"a".repeat(65536)).unwrap();
    base.commit();
    let start = base.export(ExportMode::Snapshot).unwrap();
    let local = LoroDoc::new(); local.import(&start).unwrap(); local.set_peer_id(1000).unwrap();
    local.get_text("body").insert(65536, "B").unwrap(); local.commit();
    let offline = LoroDoc::new(); offline.import(&start).unwrap(); offline.set_peer_id(1).unwrap();
    offline.get_text("body").insert(0, "Z").unwrap(); offline.commit();
    local.import(&offline.export(ExportMode::all_updates()).unwrap()).unwrap();
    assert_eq!(local.get_text("body").to_string(), format!("Z{}B", "a".repeat(65536)));
    local.get_text("body").delete(1, 65536).unwrap(); local.commit();
    assert_eq!(local.get_text("body").to_string(), "ZB");
    offline.import(&local.export(ExportMode::all_updates()).unwrap()).unwrap();
    assert_eq!(offline.get_text("body").to_string(), "ZB");
}

#[test]
fn large_incoming_insert_survives_shallow_checkpoint_and_reexport() {
    let base = LoroDoc::new(); base.set_peer_id(500).unwrap();
    base.get_text("body").insert(0, &"a".repeat(65536)).unwrap(); base.commit();
    let cut = base.state_frontiers(); let vv = base.oplog_vv();
    let start = base.export(ExportMode::Snapshot).unwrap();
    base.set_peer_id(1000).unwrap(); base.get_text("body").insert(65536, "B").unwrap(); base.commit();
    let offline = LoroDoc::new(); offline.import(&start).unwrap(); offline.set_peer_id(1).unwrap();
    offline.get_text("body").insert(0, &"Z".repeat(65536)).unwrap(); offline.commit();
    let receiver = LoroDoc::new();
    receiver.import(&base.export(ExportMode::shallow_snapshot(&cut)).unwrap()).unwrap();
    receiver.import(&offline.export(ExportMode::updates(&vv)).unwrap()).unwrap();
    assert_eq!(receiver.get_text("body").to_string(), format!("{}{}B", "Z".repeat(65536), "a".repeat(65536)));
    let reloaded = LoroDoc::new(); reloaded.import(&receiver.export(ExportMode::Snapshot).unwrap()).unwrap();
    assert_eq!(reloaded.get_deep_value(), receiver.get_deep_value());
    assert_eq!(reloaded.oplog_vv(), receiver.oplog_vv());
}
