#!/bin/bash
# 鲁港通 - Task 12.1：EDB 学校注册资料 XML 三件套服务器探测（下载到 /tmp/edb-xml-probe）
# 用法：bash server-probe-xml.sh
WORK=/tmp/edb-xml-probe
mkdir -p "$WORK"
cd "$WORK"
echo "== probe start $(date) =="
for f in SchoolBasicInfo SchoolPremises SchoolAccommodation; do
  echo "=== $f ==="
  code=$(curl -sS -o "$f.xml" -w "%{http_code}" --max-time 240 "https://applications.edb.gov.hk/datagovhk/data/$f.xml" || echo "CURL_FAIL")
  size=$(stat -c%s "$f.xml" 2>/dev/null || echo 0)
  echo "https_code=$code size=$size"
  if [ "$code" != "200" ]; then
    echo "--- retry http ---"
    code2=$(curl -sS -o "$f.xml" -w "%{http_code}" --max-time 240 "http://applications.edb.gov.hk/datagovhk/data/$f.xml" || echo "CURL_FAIL")
    size2=$(stat -c%s "$f.xml" 2>/dev/null || echo 0)
    echo "http_code=$code2 size=$size2"
  fi
  echo "--- head 500 bytes ---"
  head -c 500 "$f.xml" 2>/dev/null
  echo
  echo "--- md5 ---"
  md5sum "$f.xml" 2>/dev/null
  echo
done
echo "== done $(date) =="
ls -la "$WORK"
