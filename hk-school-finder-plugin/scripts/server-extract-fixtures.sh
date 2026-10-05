#!/bin/bash
# 鲁港通 - Task 12.1（三）：官立学校查证 + 测试夹具提取（结果写 /tmp/xml-verify.txt，fixtures 写 /tmp/edb-xml-probe/fixtures）
# 注意：awk 提取用 index/substr 截断到记录开始标签，避免首条记录带出 XML 文件头与 BOM
WORK=/tmp/edb-xml-probe
cd "$WORK" || exit 1
OUT=/tmp/xml-verify.txt
FIX="$WORK/fixtures"
mkdir -p "$FIX"
: > "$OUT"
log() { echo "$@" >> "$OUT"; }

log "== FinanceTypeChi distribution (SchoolBasicInfo) =="
grep -o '<FinanceTypeChi>[^<]*' SchoolBasicInfo.xml | sed 's/<FinanceTypeChi>//; s/ *$//' | sort | uniq -c | sort -rn | head -20 >> "$OUT"

log ""
log "== RegistrationStatusChi distribution =="
grep -o '<RegistrationStatusChi>[^<]*' SchoolBasicInfo.xml | sed 's/<RegistrationStatusChi>//; s/ *$//' | sort | uniq -c | sort -rn | head -20 >> "$OUT"

log ""
log "== '官方' 官立 keyword count in Basic =="
log "官立 count: $(grep -c '官立' SchoolBasicInfo.xml)"
log "GOVERNMENT count: $(grep -c 'GOVERNMENT' SchoolBasicInfo.xml)"

log ""
log "== QUEEN'S COLLEGE records in SchoolBasicInfo =="
awk 'BEGIN{RS="</SchoolBasicInfo>"; ORS=""} /QUEEN.{0,3}S COLLEGE/ {i=index($0, "<SchoolBasicInfo>"); print substr($0, i) "</SchoolBasicInfo>\n"}' SchoolBasicInfo.xml >> "$OUT"

log ""
log "== QUEEN'S COLLEGE in SchoolPremises =="
awk 'BEGIN{RS="</SchoolPremises>"; ORS=""} /QUEEN.{0,3}S COLLEGE/ {i=index($0, "<SchoolPremises>"); print substr($0, i) "</SchoolPremises>\n"}' SchoolPremises.xml >> "$OUT"

log ""
log "== RoomType distribution (SchoolAccommodation, top 10) =="
grep -o '<RoomType>[^<]*' SchoolAccommodation.xml | sed 's/<RoomType>//; s/ *$//' | sort | uniq -c | sort -rn | head -10 >> "$OUT"

log ""
log "== extract fixtures =="

# --- SchoolBasicInfo.sample.xml：沙田公立/喇沙/聖保羅男女(中+小)/611教育中心/QUEEN'S COLLEGE ---
{
  echo '<?xml version="1.0" encoding="UTF-8" ?>'
  echo '<Schools>'
  for num in 112526 512583 510980 514187 584487; do
    awk -v num="$num" 'BEGIN{RS="</SchoolBasicInfo>"; ORS=""} $0 ~ "<SchoolNumber>" num "</SchoolNumber>" {i=index($0, "<SchoolBasicInfo>"); print substr($0, i) "</SchoolBasicInfo>\n"}' SchoolBasicInfo.xml
  done
  awk 'BEGIN{RS="</SchoolBasicInfo>"; ORS=""} /QUEEN.{0,3}S COLLEGE/ {i=index($0, "<SchoolBasicInfo>"); print substr($0, i) "</SchoolBasicInfo>\n"}' SchoolBasicInfo.xml
  echo '</Schools>'
} > "$FIX/SchoolBasicInfo.sample.xml"

# --- SchoolPremises.sample.xml ---
{
  echo '<?xml version="1.0" encoding="UTF-8" ?>'
  echo '<Schools>'
  for num in 112526 512583 510980 514187 584487; do
    awk -v num="$num" 'BEGIN{RS="</SchoolPremises>"; ORS=""} $0 ~ "<SchoolNumber>" num "</SchoolNumber>" {i=index($0, "<SchoolPremises>"); print substr($0, i) "</SchoolPremises>\n"}' SchoolPremises.xml
  done
  awk 'BEGIN{RS="</SchoolPremises>"; ORS=""} /QUEEN.{0,3}S COLLEGE/ {i=index($0, "<SchoolPremises>"); print substr($0, i) "</SchoolPremises>\n"}' SchoolPremises.xml
  echo '</Schools>'
} > "$FIX/SchoolPremises.sample.xml"

# --- SchoolAccommodation.sample.xml：喇沙前3间 / 沙田公立1间 / 聖保羅男女各2间 / 611各2间（一次扫描） ---
{
  echo '<?xml version="1.0" encoding="UTF-8" ?>'
  echo '<Schools>'
  awk 'BEGIN{RS="</SchoolAccommodation>"; ORS=""; n=split("512583:3 112526:1 510980:2 514187:2 584487:2", specs, " ")} {
    for(i=1;i<=n;i++){
      split(specs[i], p, ":"); num=p[1]; max=p[2];
      if($0 ~ "<SchoolNumber>" num "</SchoolNumber>") {
        c[num]++;
        if(c[num]<=max) { k=index($0, "<SchoolAccommodation>"); print substr($0, k) "</SchoolAccommodation>\n"; }
      }
    }
  }' SchoolAccommodation.xml
  echo '</Schools>'
} > "$FIX/SchoolAccommodation.sample.xml"

log ""
log "== fixture stats =="
for f in SchoolBasicInfo SchoolPremises SchoolAccommodation; do
  log "$f.sample.xml: $(grep -c 'SchoolNumber' "$FIX/$f.sample.xml") records, $(stat -c%s "$FIX/$f.sample.xml") bytes"
done

echo "verify written to $OUT ($(wc -l < $OUT) lines)"
ls -la "$FIX"
