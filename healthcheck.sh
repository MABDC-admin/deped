#!/bin/bash
# Health check for all DepEd SMS components
echo "🏥 DepEd SMS Health Check"
echo "========================="
echo ""

# 1. Nginx
if systemctl is-active --quiet nginx; then
  echo "✅ Nginx: Running"
else
  echo "❌ Nginx: DOWN"
fi

# 2. App responding
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null)
if [ "$HTTP_CODE" == "200" ]; then
  echo "✅ App (port 3000): HTTP $HTTP_CODE"
else
  echo "❌ App (port 3000): HTTP $HTTP_CODE"
fi

# 3. Supabase API
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/rest/v1/ 2>/dev/null)
if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "401" ]; then
  echo "✅ Supabase API (port 8000): Responding"
else
  echo "❌ Supabase API (port 8000): HTTP $HTTP_CODE"
fi

# 4. Docker containers
HEALTHY=$(docker ps --filter "health=healthy" --format "{{.Names}}" | wc -l)
TOTAL=$(docker ps --format "{{.Names}}" | wc -l)
if [ "$HEALTHY" -ge 10 ]; then
  echo "✅ Docker: $HEALTHY/$TOTAL containers healthy"
else
  echo "⚠️  Docker: $HEALTHY/$TOTAL containers healthy"
  docker ps --filter "health=unhealthy" --format "  ❌ {{.Names}}: {{.Status}}" 2>/dev/null
fi

# 5. Disk
DISK_USAGE=$(df -h / | awk 'NR==2{print $5}')
echo "💾 Disk usage: $DISK_USAGE"

# 6. Memory
MEM=$(free -m | awk 'NR==2{printf "%.0f%%", $3*100/$2}')
echo "🧠 Memory usage: $MEM"

# 7. Last backup
LAST_BACKUP=$(ls -t /root/backups/sms_db_*.sql.gz 2>/dev/null | head -1)
if [ -n "$LAST_BACKUP" ]; then
  BACKUP_SIZE=$(du -h "$LAST_BACKUP" | cut -f1)
  BACKUP_DATE=$(stat -c %y "$LAST_BACKUP" | cut -d. -f1)
  echo "📀 Last backup: $BACKUP_DATE ($BACKUP_SIZE)"
else
  echo "⚠️  No backups found!"
fi

echo ""
echo "Check complete: $(date)"
