#!/bin/bash
# 鲁港通 - Task 12.1（二）：XML 结构分析 + 目标学校记录预览（结果写 /tmp/xml-analysis.txt 后回传）
WORK=/tmp/edb-xml-probe
cd "$WORK"
OUT=/tmp/xml-analysis.txt
: > "$OUT"

log() { echo "$@" >> "$OUT"; }

log "== record counts =="
for f in SchoolBasicInfo SchoolPremises SchoolAccommodation; do
  log "$f records: $(grep -c "<$f>" $f.xml)"
done

log ""
log "== unique tags: SchoolBasicInfo =="
grep -o '<[A-Za-z][A-Za-z0-9]*>' SchoolBasicInfo.xml | sort | uniq -c | sort -rn | head -40 >> "$OUT"

log ""
log "== first record: SchoolBasicInfo =="
awk 'BEGIN{RS="</SchoolBasicInfo>"; ORS=""} NR==1 {print $0 "</SchoolBasicInfo>\n"; exit}' SchoolBasicInfo.xml >> "$OUT"

log ""
log "== first record: SchoolPremises =="
awk 'BEGIN{RS="</SchoolPremises>"; ORS=""} NR==1 {print $0 "</SchoolPremises>\n"; exit}' SchoolPremises.xml >> "$OUT"

log ""
log "== first record: SchoolAccommodation =="
awk 'BEGIN{RS="</SchoolAccommodation>"; ORS=""} NR==1 {print $0 "</SchoolAccommodation>\n"; exit}' SchoolAccommodation.xml >> "$OUT"

log ""
log "== SchoolLevelEng distribution =="
grep -o '<SchoolLevelEng>[^<]*' SchoolBasicInfo.xml | sed 's/<SchoolLevelEng>//' | sort | uniq -c | sort -rn | head -30 >> "$OUT"

log ""
log "== target: 喇沙書院 in SchoolBasicInfo =="
awk 'BEGIN{RS="</SchoolBasicInfo>"; ORS=""} /喇沙書院/ {print $0 "</SchoolBasicInfo>\n"}' SchoolBasicInfo.xml >> "$OUT"

log ""
log "== target: 聖保羅男女中學 in SchoolBasicInfo =="
awk 'BEGIN{RS="</SchoolBasicInfo>"; ORS=""} /聖保羅男女中學/ {print $0 "</SchoolBasicInfo>\n"}' SchoolBasicInfo.xml >> "$OUT"

log ""
log "== target: 拔萃 in SchoolBasicInfo (head 350 lines) =="
awk 'BEGIN{RS="</SchoolBasicInfo>"; ORS=""} /拔萃/ {print $0 "</SchoolBasicInfo>\n"}' SchoolBasicInfo.xml | head -350 >> "$OUT"

log ""
log "== gov school check: QUEEN'S COLLEGE count =="
awk 'BEGIN{RS="</SchoolBasicInfo>"; ORS=""} /QUEEN.{0,3}S COLLEGE/ {c++} END{print "QUEENS COLLEGE records: " c+0}' SchoolBasicInfo.xml >> "$OUT"

log ""
log "== target: 611 in SchoolBasicInfo (head 150 lines) =="
awk 'BEGIN{RS="</SchoolBasicInfo>"; ORS=""} /611/ {print $0 "</SchoolBasicInfo>\n"}' SchoolBasicInfo.xml | head -150 >> "$OUT"

log ""
log "== target: 喇沙書院 records in SchoolPremises =="
awk 'BEGIN{RS="</SchoolPremises>"; ORS=""} /喇沙書院/ {print $0 "</SchoolPremises>\n"}' SchoolPremises.xml >> "$OUT"

log ""
log "== target: 喇沙書院 records in SchoolAccommodation (head 200 lines) =="
awk 'BEGIN{RS="</SchoolAccommodation>"; ORS=""} /喇沙書院/ {print $0 "</SchoolAccommodation>\n"}' SchoolAccommodation.xml | head -200 >> "$OUT"

log ""
log "== unique tags: SchoolPremises =="
grep -o '<[A-Za-z][A-Za-z0-9]*>' SchoolPremises.xml | sort | uniq -c | sort -rn | head -30 >> "$OUT"

log ""
log "== unique tags: SchoolAccommodation =="
grep -o '<[A-Za-z][A-Za-z0-9]*>' SchoolAccommodation.xml | sort | uniq -c | sort -rn | head -40 >> "$OUT"

echo "analysis written to $OUT ($(wc -l < $OUT) lines)"
