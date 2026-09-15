#!/usr/bin/env sh
# =============================================================================
# Elasticsearch Setup Script for TalentFlow
# Run once after Elasticsearch is healthy to create:
#   - ILM policy (Index Lifecycle Management)
#   - Index templates for each service
# =============================================================================

ES_HOST="${ELASTICSEARCH_HOST:-http://elasticsearch:9200}"

echo "⏳ Waiting for Elasticsearch at ${ES_HOST} ..."
until curl -sf "${ES_HOST}/_cluster/health?wait_for_status=yellow&timeout=5s" > /dev/null; do
  sleep 3
done
echo "✅ Elasticsearch is ready."

# ─── ILM Policy ─────────────────────────────────────────────────────────────
# hot  → active writes, rollover after 7 days or 50 GB
# warm → read-only, force-merge, shrink after 30 days
# delete → remove after 90 days total
echo "📋 Creating ILM policy: talentflow-logs-policy ..."
curl -sf -X PUT "${ES_HOST}/_ilm/policy/talentflow-logs-policy" \
  -H 'Content-Type: application/json' \
  -d '
{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": {
            "max_primary_shard_size": "50gb",
            "max_age": "7d"
          },
          "set_priority": { "priority": 100 }
        }
      },
      "warm": {
        "min_age": "7d",
        "actions": {
          "forcemerge": { "max_num_segments": 1 },
          "shrink": { "number_of_shards": 1 },
          "set_priority": { "priority": 50 },
          "readonly": {}
        }
      },
      "delete": {
        "min_age": "90d",
        "actions": {
          "delete": { "delete_searchable_snapshot": true }
        }
      }
    }
  }
}' && echo "✅ ILM policy created." || echo "⚠️  ILM policy already exists or error."

# ─── Index Template — api-gateway ────────────────────────────────────────────
echo "📋 Creating index template: talentflow-api-gateway ..."
curl -sf -X PUT "${ES_HOST}/_index_template/talentflow-api-gateway" \
  -H 'Content-Type: application/json' \
  -d '
{
  "index_patterns": ["talentflow-api-gateway-*"],
  "template": {
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0,
      "index.lifecycle.name": "talentflow-logs-policy",
      "index.lifecycle.rollover_alias": "talentflow-api-gateway"
    },
    "mappings": {
      "properties": {
        "@timestamp":  { "type": "date" },
        "message":     { "type": "text" },
        "severity":    { "type": "keyword" },
        "service":     { "type": "keyword" },
        "environment": { "type": "keyword" },
        "method":      { "type": "keyword" },
        "url":         { "type": "keyword" },
        "status":      { "type": "integer" },
        "duration":    { "type": "long" },
        "requestId":   { "type": "keyword" },
        "traceId":     { "type": "keyword" },
        "spanId":      { "type": "keyword" }
      }
    }
  },
  "priority": 200
}' && echo "✅ api-gateway template created." || echo "⚠️  Template already exists."

# ─── Index Template — notification ───────────────────────────────────────────
echo "📋 Creating index template: talentflow-notification ..."
curl -sf -X PUT "${ES_HOST}/_index_template/talentflow-notification" \
  -H 'Content-Type: application/json' \
  -d '
{
  "index_patterns": ["talentflow-notification-*"],
  "template": {
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0,
      "index.lifecycle.name": "talentflow-logs-policy",
      "index.lifecycle.rollover_alias": "talentflow-notification"
    },
    "mappings": {
      "properties": {
        "@timestamp":  { "type": "date" },
        "message":     { "type": "text" },
        "severity":    { "type": "keyword" },
        "service":     { "type": "keyword" },
        "environment": { "type": "keyword" },
        "channel":     { "type": "keyword" },
        "status":      { "type": "keyword" },
        "traceId":     { "type": "keyword" }
      }
    }
  },
  "priority": 200
}' && echo "✅ notification template created." || echo "⚠️  Template already exists."

# ─── Kibana Data View ─────────────────────────────────────────────────────────
# Wait for Kibana to be ready then create data view
KIBANA_HOST="${KIBANA_HOST:-http://kibana:5601}"
echo "⏳ Waiting for Kibana at ${KIBANA_HOST} ..."
KIBANA_RETRIES=0
until curl -sf "${KIBANA_HOST}/api/status" > /dev/null || [ $KIBANA_RETRIES -ge 20 ]; do
  sleep 5
  KIBANA_RETRIES=$((KIBANA_RETRIES + 1))
done

if curl -sf "${KIBANA_HOST}/api/status" > /dev/null; then
  echo "✅ Kibana is ready. Creating data view ..."
  curl -sf -X POST "${KIBANA_HOST}/api/data_views/data_view" \
    -H 'Content-Type: application/json' \
    -H 'kbn-xsrf: true' \
    -d '
  {
    "data_view": {
      "title": "talentflow-*",
      "name": "TalentFlow Logs",
      "timeFieldName": "@timestamp",
      "allowNoIndex": true
    }
  }' && echo "✅ Kibana data view created." || echo "⚠️  Data view may already exist."
else
  echo "⚠️  Kibana not ready — skipping data view creation."
fi

echo ""
echo "🎉 Elasticsearch setup complete!"
echo "   ILM policy:    talentflow-logs-policy (hot 7d → warm 30d → delete 90d)"
echo "   Index templates: talentflow-api-gateway-*, talentflow-notification-*"
echo "   Kibana data view: talentflow-*"
