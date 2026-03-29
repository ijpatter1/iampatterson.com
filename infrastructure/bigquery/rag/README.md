# RAG Infrastructure

Semantic search and AI-powered querying over the iampatterson mart data.

## Prerequisites

1. **Vertex AI API** enabled:
   ```bash
   gcloud services enable aiplatform.googleapis.com --project=iampatterson
   ```

2. **BigQuery Cloud Resource connection** created:
   ```bash
   bq mk --connection --connection_type=CLOUD_RESOURCE --location=US vertex-ai-connection
   ```

3. **Grant Vertex AI User** to the connection's service account:
   ```bash
   # Get the service account email
   bq show --connection --location=US vertex-ai-connection

   # Grant the role
   gcloud projects add-iam-policy-binding iampatterson \
     --member="serviceAccount:<CONNECTION_SA>" \
     --role="roles/aiplatform.user"
   ```

## Setup

Run the SQL statements in `setup_rag.sql` in order:

```bash
bq query --use_legacy_sql=false < setup_rag.sql
```

This creates:
- `embedding_model` — text-embedding-005 via Vertex AI
- `gemini_model` — Gemini 2.0 Flash for text generation
- `rag_campaign_embeddings` — vector embeddings of campaign performance data
- `rag_channel_embeddings` — vector embeddings of channel attribution data
- `rag_subscription_embeddings` — vector embeddings of subscription cohort data
- Vector indexes on all embedding tables (IVF, cosine distance)

## Usage

### Semantic search (natural language → data-grounded answer)

```sql
CALL iampatterson_marts.semantic_search(
  'Which channels drive the highest ROAS for e-commerce?',
  10  -- top_k results to retrieve
);
```

### Business-specific query (no embeddings needed)

```sql
CALL iampatterson_marts.query_business(
  'ecommerce',
  'What is my best performing campaign this month?'
);
```

## Refreshing Embeddings

Re-run the `CREATE OR REPLACE TABLE` statements in `setup_rag.sql` after each Dataform run to keep embeddings current with the latest mart data. This can be scheduled via Cloud Scheduler or a Dataform post-hook.
