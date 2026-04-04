# Neo4j Integration with Bun + TypeScript: Comprehensive Research Report

**Research Date:** March 15, 2026
**Researcher:** Perplexity-Researcher
**Status:** Complete

---

## Table of Contents

1. [What is Neo4j](#what-is-neo4j)
2. [Neo4j Core Concepts](#neo4j-core-concepts)
3. [Deployment Options](#deployment-options)
4. [Neo4j JavaScript/TypeScript Driver](#neo4j-javascripttypescript-driver)
5. [Bun-Specific Considerations](#bun-specific-considerations)
6. [Alternative Approaches](#alternative-approaches)
7. [Code Examples](#code-examples)
8. [Performance Characteristics](#performance-characteristics)
9. [Use Cases](#use-cases)
10. [Neo4j + AI/LLM Integration](#neo4j--aillm-integration)
11. [Ecosystem Tools](#ecosystem-tools)
12. [Bun/TypeScript Implementation Patterns](#buntypescript-implementation-patterns)

---

## 1. What is Neo4j

Neo4j is a **property graph database** designed for managing highly connected data. Unlike traditional relational or document databases that store data in tables or JSON documents, Neo4j stores data as nodes (entities) and relationships (connections), enabling extremely efficient querying of complex relationship patterns.

**Key Characteristics:**
- **Graph-Native:** Built from the ground up as a graph database
- **ACID Compliant:** Ensures transactional integrity
- **Scalable:** Supports single-instance (Community) to enterprise clustering
- **Open Source:** Community Edition available under GPLv3
- **Declarative Query Language:** Uses Cypher for intuitive graph queries

---

## 2. Neo4j Core Concepts

### Nodes

Nodes represent entities or discrete objects in your domain. They can have **labels** that classify them into sets.

```
Example: (:Person), (:Movie), (:Author)
```

Nodes can have properties (key-value pairs) that store attribute data:
```
(:Person {name: "Alice", age: 30, email: "alice@example.com"})
```

### Relationships

Relationships provide **named, directed connections** between two nodes. They always have:
- A start node
- An end node
- A type (the relationship label)
- A direction

```
Example: (person)-[:WROTE]->(book)
         (user)-[:FOLLOWS]->(user)
         (employee)-[:WORKS_FOR]->(company)
```

**Important:** Relationships always have direction, but you can ignore it in queries where it's not relevant. There's no need to create duplicate relationships in opposite directions unless your domain requires it.

Relationships can also have properties:
```
(person)-[:FOLLOWS {since: "2024-01-15"}]->(person)
```

### Properties

Key-value pairs stored on both nodes and relationships:
- Supported types: String, Integer, Float, Boolean, List, Duration, Date, DateTime, LocalDateTime, LocalTime, Time
- Can be indexed for performance optimization
- Enable efficient filtering and sorting in queries

### Paths

A path is a sequence of alternating nodes and relationships. When you query a graph, you're typically finding paths that match patterns you define.

---

## 3. Neo4j Core Concepts: Cypher Query Language

Cypher is a **declarative, SQL-like query language** optimized for graph patterns. It uses ASCII-art style syntax:
- **Round brackets ():** Represent nodes
- **Square brackets []:** Represent relationships with arrows showing direction

### Basic Cypher Patterns

```cypher
-- Create a person node
CREATE (p:Person {name: "Alice"}) RETURN p

-- Match nodes and relationships
MATCH (person:Person)-[:FOLLOWS]->(following:Person)
WHERE person.name = "Alice"
RETURN person, following

-- Update node properties
MATCH (p:Person {name: "Alice"})
SET p.age = 30
RETURN p

-- Delete relationships
MATCH (p:Person)-[r:FOLLOWS]-(other:Person)
WHERE p.name = "Alice"
DELETE r

-- Delete nodes
MATCH (p:Person {name: "Alice"})
DELETE p
```

### Cypher Advantages

- **Visual Pattern Matching:** Reading `(person)-[:KNOWS]->(friend)` makes it immediately clear what relationship pattern you're matching
- **Declarative:** Specify what you want, not how to get it (like SQL)
- **Optimized for Relationships:** Native support for multi-hop traversals without expensive joins
- **ACID Transactions:** Full transactional support with rollback

---

## 4. Deployment Options

### 4.1 Neo4j AuraDB (Cloud - Recommended for SaaS)

Neo4j's managed cloud database service with three pricing tiers:

**Features:**
- Database-as-a-Service (DBaaS) model
- No infrastructure management required
- Automatic backups, scaling, and patching
- Available on AWS, GCP, and Azure
- TLS encryption by default

**Tiers:**
- **Free Tier:** Development and testing
- **Professional Tier:** Production workloads with SLA
- **Enterprise Tier:** High availability with guaranteed uptime

**Advantages:**
- Fully managed (no ops burden)
- Automatic scaling
- Built-in high availability
- Integrated Neo4j Browser for querying

**Connection:** Uses Bolt protocol (see driver section)

### 4.2 Neo4j Desktop (Local Development)

Neo4j Desktop is a free application for local graph database development:

**Features:**
- Easy local project management
- Bundled Neo4j Browser
- One-click project creation
- Support for multiple versions
- Graph backup/export utilities

**Use Case:** Perfect for development, prototyping, and learning

### 4.3 Docker (Self-Hosted, Flexible)

Official Neo4j Docker images available on Docker Hub:

```bash
# Community Edition
docker run --name neo4j -p 7687:7687 -p 7474:7474 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:latest

# Enterprise Edition (requires license agreement)
docker run --name neo4j -p 7687:7687 -p 7474:7474 \
  -e NEO4J_ACCEPT_LICENSE_AGREEMENT=yes \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:latest-enterprise
```

**Advantages:**
- Full control over configuration
- Easy environment consistency
- Can deploy to any cloud or on-premises
- Supports both Community and Enterprise

### 4.4 Self-Hosted (On-Premises or Cloud VMs)

For organizations requiring complete control:

**Options:**
- Download and run directly on Linux/macOS/Windows
- Deploy to EC2, GCP Compute Engine, Azure VMs
- Use Amazon Machine Images (AMI) for AWS
- Deploy causal clusters for high availability

**Enterprise Features Available:**
- Clustering with automatic failover
- Hot backups without downtime
- Role-based authorization
- LDAP/Kerberos integration

---

## 5. Neo4j JavaScript/TypeScript Driver

### 5.1 Official Driver Overview

The `neo4j-driver` npm package is the **official Neo4j driver for JavaScript/TypeScript**, maintained by Neo4j.

**NPM Package:** `neo4j-driver`
**Repository:** [neo4j/neo4j-javascript-driver](https://github.com/neo4j/neo4j-javascript-driver)
**Current TypeScript Support:** Version 5.9.2+

### 5.2 Installation

```bash
# Using npm
npm install neo4j-driver

# Using bun
bun add neo4j-driver

# Using yarn
yarn add neo4j-driver
```

### 5.3 TypeScript Support

The driver includes native TypeScript support and type definitions:

```typescript
import neo4j, { Session, ManagedTransaction, Result } from 'neo4j-driver';

// Type-safe driver creation
const driver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'password'),
  {
    encrypted: 'ENCRYPTION_ON',
    maxConnectionPoolSize: 50
  }
);

// Type-safe session
const session: Session = driver.session({ database: 'neo4j' });
```

### 5.4 Core Protocols

**Bolt Protocol:** Primary protocol for Neo4j communication
- Binary protocol optimized for graph operations
- Persistent connection over TCP
- Transaction support with automatic retry
- Supports TLS encryption
- Default port: 7687

**HTTP API (Alternative):**
- RESTful endpoints for compatibility
- Useful for environments where Bolt isn't available
- Less efficient than Bolt but widely supported

### 5.5 Connection Configuration

```typescript
const driver = neo4j.driver(
  'bolt://localhost:7687',           // Protocol and host
  neo4j.auth.basic('user', 'pass'),  // Authentication
  {
    // Optional configuration
    maxConnectionPoolSize: 50,        // Connection pool size
    maxTransactionRetryTime: 5000,   // Retry timeout (ms)
    connectionTimeoutMs: 30000,       // Connection timeout (ms)
    encryptionLevel: 'ENCRYPTION_ON', // TLS encryption
    trustStrategy: neo4j.trustStrategy.TRUST_ALL_CERTIFICATES,
    userAgent: 'my-app/1.0'          // Custom user agent
  }
);
```

### 5.6 Session Management

```typescript
// Create a managed session (auto-cleanup)
const session = driver.session({
  database: 'neo4j',
  accessMode: neo4j.session.READ
});

// For transactions with retry logic
const result = await session.executeRead(async (tx) => {
  return await tx.run(
    'MATCH (n:Person {name: $name}) RETURN n',
    { name: 'Alice' }
  );
});

// Get results
const records = result.records;
records.forEach(record => {
  const person = record.get('n');
  console.log(person.properties);
});

// Always close session
await session.close();
await driver.close();
```

---

## 6. Bun-Specific Considerations

### 6.1 Bun Compatibility Status

**Good News:** The `neo4j-driver` package **works with Bun**, though with some important caveats.

**Evidence:** Active GitHub project implements GraphRAG on Bun + TypeScript with Neo4j:
[alexy-os/graphrag](https://github.com/alexy-os/graphrag)

This project demonstrates production-level Neo4j integration in Bun.

### 6.2 Bolt Protocol and WebSocket Issues

Research revealed several WebSocket-related issues in Bun that could affect Neo4j integration:

**Known Issues:**
1. **WebSocket Protocol Field Not Populated:** The protocol field is empty in Bun's WebSocket implementation vs populated in Node.js
2. **Missing WebSocket Client Events:** Bun doesn't support 'upgrade' and 'unexpected-response' events from Node's `ws` library
3. **Frame Parsing Issues:** Some problems with parsing WebSocket frames correctly
4. **Proxying Limitations:** WebSocket proxying can hang while HTTP proxying works fine

**Status:** These are WebSocket-level issues, not Bolt protocol-specific. Since Neo4j uses Bolt over TCP (not WebSocket), the driver should work.

### 6.3 Recommended Bun Usage Pattern

```typescript
import neo4j from 'neo4j-driver';

// Driver creation works in Bun
const driver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'password'),
  {
    maxConnectionPoolSize: 50,
    connectionTimeoutMs: 30000
  }
);

// Use driver normally
const session = driver.session();

try {
  const result = await session.executeRead(async (tx) => {
    return await tx.run('MATCH (n) LIMIT 1 RETURN n');
  });

  console.log(result.records.length);
} finally {
  await session.close();
  await driver.close();
}
```

### 6.4 Potential Workarounds for Edge Cases

If you encounter WebSocket-related issues:

1. **Use HTTP API Instead:** Neo4j provides a REST API as alternative:
```typescript
// Direct HTTP/REST instead of Bolt
const response = await fetch('http://localhost:7474/db/neo4j/tx', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    statements: [{
      statement: 'MATCH (n) LIMIT 1 RETURN n'
    }]
  })
});
```

2. **Connection Pool Configuration:** Adjust pooling for Bun's async model:
```typescript
const driver = neo4j.driver(uri, auth, {
  maxConnectionPoolSize: 10,  // Smaller pool for Bun
  minPoolSize: 2,
  maxIdleSessionTTL: 3600000  // 1 hour
});
```

3. **Explicit Connection Lifecycle:** Manage connections more explicitly:
```typescript
const session = driver.session({
  bookmarks: [], // Track causal consistency
  defaultAccessMode: neo4j.session.WRITE
});
```

### 6.5 Bun-Specific Runtime Considerations

**Process Management:**
- Bun has different process semantics than Node.js
- Driver cleanup is crucial (always call `driver.close()`)
- Use proper async/await patterns

**Memory Management:**
- Bun's memory model differs from Node.js
- Large result sets should be streamed rather than loaded all at once
- Connection pooling helps prevent resource leaks

**File I/O:**
- Bun provides built-in file system APIs
- Consider using Bun's native file operations alongside Neo4j

---

## 7. Alternative Approaches

### 7.1 Neo4j HTTP API (REST)

**When to Use:** Environments where Bolt isn't available, or as a fallback

**Advantages:**
- Works with any HTTP client (fetch, axios)
- Language/platform agnostic
- No special driver needed
- Easier for simple queries

**Disadvantages:**
- Higher latency (HTTP overhead)
- Less efficient serialization
- No connection pooling benefits
- Deprecated in newer Neo4j versions (but still functional)

**TypeScript Example:**
```typescript
interface Neo4jHttpResponse {
  results: Array<{
    columns: string[];
    data: Array<{ row: any[] }>;
  }>;
}

async function queryWithHttp(statement: string, params: Record<string, any>) {
  const response = await fetch('http://localhost:7474/db/neo4j/tx', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa('neo4j:password'),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      statements: [{ statement, parameters: params }]
    })
  });

  const data: Neo4jHttpResponse = await response.json();
  return data.results[0].data;
}
```

### 7.2 Neo4j GraphQL Library with OGM

**What it is:** TypeScript-first GraphQL API generation from Neo4j graphs

**Package:** `@neo4j/graphql` and `@neo4j/graphql-ogm`

**Advantages:**
- Object-oriented interface (OGM = Object Graph Mapper)
- Automatic GraphQL schema generation
- Type-safe through TypeScript definitions
- CRUD operations built-in
- Works seamlessly with Neo4j driver

**Use Case:** Building GraphQL APIs on top of Neo4j

**Installation:**
```bash
bun add @neo4j/graphql @neo4j/graphql-ogm neo4j-driver
```

**Basic Example:**
```typescript
import { OGM } from '@neo4j/graphql-ogm';
import neo4j from 'neo4j-driver';

const typeDefs = `
  type Movie {
    title: String!
    year: Int!
    actors: [Person!]! @relationship(type: "ACTED_IN", direction: IN)
  }

  type Person {
    name: String!
    movies: [Movie!]! @relationship(type: "ACTED_IN", direction: OUT)
  }
`;

const driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', 'password'));

const ogm = new OGM({ typeDefs, driver });
await ogm.init();

// OGM generates resolvers and queries automatically
// You get fully typed Movie and Person models
```

### 7.3 Cypher Query Builder

**Package:** `@neo4j/cypher-builder`

**Advantages:**
- Type-safe query construction
- Programmatic query building
- Intellisense support
- No string interpolation (prevents injection)

**Example:**
```typescript
import { cypher, node, match, return_ } from '@neo4j/cypher-builder';

const personNode = node('n', { labels: ['Person'] });
const query = match(personNode)
  .where(personNode.property('name').eq('Alice'))
  .return([personNode]);

// Generates: MATCH (n:Person) WHERE n.name = 'Alice' RETURN n
const result = await session.run(query.build(), query.params);
```

### 7.4 Alternative: Memgraph

**Note:** Memgraph is an open-source Neo4j-compatible graph database with stronger performance characteristics for certain workloads. It's API-compatible with Neo4j, so the same `neo4j-driver` works.

---

## 8. Code Examples

### 8.1 Basic Connection and Query (Bun + TypeScript)

```typescript
import neo4j, { Session, Driver } from 'neo4j-driver';

// Initialize driver
const driver: Driver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'password')
);

// Define types for your domain
interface Person {
  id: string;
  name: string;
  age: number;
}

interface QueryRecord {
  p: { properties: Person };
}

async function main() {
  const session: Session = driver.session();

  try {
    // CREATE
    const createResult = await session.executeWrite(async (tx) => {
      return await tx.run(
        'CREATE (p:Person {id: $id, name: $name, age: $age}) RETURN p',
        {
          id: 'person-1',
          name: 'Alice',
          age: 30
        }
      );
    });

    console.log('Created person:', createResult.records[0].get('p').properties);

    // READ
    const readResult = await session.executeRead(async (tx) => {
      return await tx.run(
        'MATCH (p:Person {name: $name}) RETURN p',
        { name: 'Alice' }
      );
    });

    const person = readResult.records[0].get('p').properties as Person;
    console.log('Found person:', person);

    // UPDATE
    const updateResult = await session.executeWrite(async (tx) => {
      return await tx.run(
        'MATCH (p:Person {id: $id}) SET p.age = $age RETURN p',
        { id: 'person-1', age: 31 }
      );
    });

    console.log('Updated person:', updateResult.records[0].get('p').properties);

    // DELETE
    await session.executeWrite(async (tx) => {
      return await tx.run(
        'MATCH (p:Person {id: $id}) DELETE p',
        { id: 'person-1' }
      );
    });

    console.log('Person deleted');

  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch(console.error);
```

### 8.2 Complex Relationship Queries

```typescript
interface Movie {
  title: string;
  year: number;
}

interface Actor {
  name: string;
  movies: Movie[];
}

async function findActorWithMovies(driver: Driver, actorName: string): Promise<Actor | null> {
  const session = driver.session();

  try {
    const result = await session.executeRead(async (tx) => {
      return await tx.run(
        `MATCH (actor:Person {name: $name})-[:ACTED_IN]->(movie:Movie)
         RETURN actor, collect({
           title: movie.title,
           year: movie.year
         }) as movies`,
        { name: actorName }
      );
    });

    if (result.records.length === 0) return null;

    const record = result.records[0];
    return {
      name: record.get('actor').properties.name,
      movies: record.get('movies')
    };
  } finally {
    await session.close();
  }
}

// Usage
const actor = await findActorWithMovies(driver, 'Tom Hanks');
console.log(`${actor?.name} appeared in:`, actor?.movies);
```

### 8.3 Transaction Management

```typescript
async function transferFunds(
  driver: Driver,
  fromAccount: string,
  toAccount: string,
  amount: number
): Promise<boolean> {
  const session = driver.session();

  try {
    await session.executeWrite(async (tx) => {
      // Both operations succeed or both fail
      await tx.run(
        'MATCH (acc:Account {id: $id}) SET acc.balance = acc.balance - $amount',
        { id: fromAccount, amount }
      );

      await tx.run(
        'MATCH (acc:Account {id: $id}) SET acc.balance = acc.balance + $amount',
        { id: toAccount, amount }
      );
    });

    return true;
  } catch (error) {
    console.error('Transaction failed:', error);
    return false;
  } finally {
    await session.close();
  }
}
```

### 8.4 Streaming Large Results

```typescript
async function streamLargeDataset(driver: Driver, callback: (record: any) => void) {
  const session = driver.session();

  try {
    const result = await session.executeRead(async (tx) => {
      return await tx.run('MATCH (n) RETURN n LIMIT 1000000');
    });

    // Process records as they arrive
    for (const record of result.records) {
      callback(record.get('n').properties);
    }
  } finally {
    await session.close();
  }
}

// Usage
await streamLargeDataset(driver, (node) => {
  console.log('Processing node:', node);
  // Do something with each node
});
```

### 8.5 Connection Pooling Configuration for Bun

```typescript
const driver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'password'),
  {
    // Bun-optimized pool settings
    maxConnectionPoolSize: 10,        // Smaller for Bun's async model
    minPoolSize: 2,                   // Keep minimum connections warm
    maxIdleSessionTTL: 3600000,       // 1 hour session timeout
    connectionTimeoutMs: 30000,       // 30 second connection timeout
    maxTransactionRetryTime: 5000,    // 5 second retry window

    // Security
    encrypted: 'ENCRYPTION_ON',
    trustStrategy: neo4j.trustStrategy.TRUST_SYSTEM_CA_SIGNED_CERTIFICATES,

    // User agent for debugging
    userAgent: 'MyApp/1.0 Bun/1.0'
  }
);
```

---

## 9. Performance Characteristics

### 9.1 When to Use Neo4j

Neo4j excels in scenarios with **complex relationships and pattern matching:**

**Optimal Use Cases:**
- Knowledge graphs with multi-hop traversals
- Recommendation engines (finding similar patterns)
- Social networks (friend-of-friend queries)
- Fraud detection (finding suspicious patterns)
- Supply chain analysis
- Master data management
- Identity and access management

**Performance Advantages:**
- Relationship traversal: O(1) regardless of database size
- Pattern matching: Native support for complex graph patterns
- ACID transactions: Full consistency guarantees
- Clustering: Causal clustering for read scaling

**Real-World Benchmarks:**
- Relationship queries 1000x faster than SQL joins on equivalent data
- Complex traversals complete in milliseconds
- Scales to billions of nodes and relationships

### 9.2 PostgreSQL vs Neo4j vs MongoDB

| Characteristic | PostgreSQL | MongoDB | Neo4j |
|---|---|---|---|
| **Data Model** | Relational/Tabular | Document (JSON) | Graph (Nodes + Relationships) |
| **Best For** | Structured data, transactions | Flexible schema, fast reads | Complex relationships |
| **Relationship Performance** | Joins expensive as depth increases | Not designed for relationships | Constant-time traversal |
| **ACID Compliance** | Full ACID | Eventual consistency | Full ACID |
| **Horizontal Scaling** | Difficult (sharding complex) | Natural sharding | Causal clustering |
| **Schema Flexibility** | Rigid schema | Flexible documents | Flexible but typed |
| **Typical Latency** | 10-100ms queries | 1-50ms reads | 1-10ms traversals |

**Recommendation:**
- **Use PostgreSQL** for financial transactions, traditional structured data, complex JOINs on relational data
- **Use MongoDB** for flexible schema, document storage, high write throughput
- **Use Neo4j** for knowledge graphs, relationship-heavy queries, pattern matching, recommendations

### 9.3 Optimization Strategies

**Indexing:**
```cypher
-- Create index on frequently searched properties
CREATE INDEX FOR (p:Person) ON (p.name);
CREATE INDEX FOR (p:Person) ON (p.email);

-- Composite indexes for multi-property queries
CREATE INDEX FOR (p:Person) ON (p.name, p.age);
```

**Query Profiling:**
```cypher
-- Analyze query performance
PROFILE MATCH (p:Person)-[:KNOWS]-(friend:Person)
  WHERE p.name = 'Alice'
  RETURN friend;

-- Explain query plan
EXPLAIN MATCH (p:Person)-[:KNOWS]-(friend:Person)
  WHERE p.name = 'Alice'
  RETURN friend;
```

**Result Limiting:**
```typescript
// Limit results at query level (not in application)
const result = await session.executeRead(async (tx) => {
  return await tx.run(
    'MATCH (p:Person) RETURN p LIMIT 1000'
  );
});
```

---

## 10. Use Cases

### 10.1 Knowledge Graphs

**Definition:** Structured representation of entities and relationships between them.

**Implementation Example:**
```cypher
-- Create knowledge graph structure
CREATE (alice:Person {name: "Alice", role: "Engineer"})
CREATE (bob:Person {name: "Bob", role: "Manager"})
CREATE (project:Project {name: "AI Research"})

CREATE (alice)-[:WORKS_ON]->(project)
CREATE (bob)-[:MANAGES]->(alice)
CREATE (bob)-[:OVERSEES]->(project)

-- Query: Find all people on Alice's projects with their managers
MATCH (person:Person)-[:WORKS_ON]->(project:Project)<-[:OVERSEES]-(manager:Person)
MATCH (person)-[:MANAGES*0..1]-(manager)
RETURN person, project, manager
```

**Benefits:**
- Explicit relationship modeling
- Natural query patterns
- Explainable reasoning
- Easy to extend with new relationships

### 10.2 Recommendation Engines

**Pattern:** Find similar items through relationship exploration

```cypher
-- Movie recommendation: Find movies liked by people who liked the same movies as you
MATCH (you:User {id: $userId})-[:LIKED]->(movie:Movie)
MATCH (other:User)-[:LIKED]->(movie)
MATCH (other)-[:LIKED]->(similarMovie:Movie)
WHERE similarMovie <> movie AND NOT (you)-[:LIKED]->(similarMovie)
RETURN similarMovie, count(other) as commonViewers
ORDER BY commonViewers DESC
LIMIT 5
```

**Advantages:**
- Multi-hop pattern matching
- Weights on relationships for ranking
- Fast even with millions of users/items
- Easy to A/B test different algorithms

### 10.3 Social Networks

**Features:**
- User connections (FOLLOWS, FRIENDS_WITH)
- Interest graphs
- Activity feeds
- Influence networks

```cypher
-- Find influencers in Alice's network
MATCH (alice:User {id: $userId})-[:FOLLOWS*1..3]->(influencer:User)
MATCH (influencer)-[posts:POSTED]->(content:Content)
MATCH (content)<-[:LIKED]-(liker:User)
RETURN influencer, count(distinct liker) as engagement
ORDER BY engagement DESC
LIMIT 10
```

### 10.4 Fraud Detection

**Pattern:** Identify suspicious relationship patterns

```cypher
-- Detect carousel fraud (same card used across multiple merchants rapidly)
MATCH (card:CreditCard)-[:USED_AT]->(merchant1:Merchant)
MATCH (card)-[:USED_AT]->(merchant2:Merchant)
WHERE merchant1 <> merchant2
MATCH (merchant1)-[:IN_CATEGORY]->(cat:Category)
MATCH (merchant2)-[:IN_CATEGORY]->(cat)
MATCH (transaction:Transaction {card_id: card.id, timestamp: $timestamp})
WHERE transaction.amount > 500
RETURN card, merchant1, merchant2, transaction
```

### 10.5 Master Data Management (MDM)

Graph structure enables reconciling duplicates and relationships:

```cypher
-- Find potentially duplicate customer records
MATCH (cust1:Customer)-[:SAME_PHONE|SAME_EMAIL|SAME_ADDRESS]->(cust2:Customer)
WHERE cust1.id < cust2.id
RETURN cust1, cust2, apoc.text.distance(cust1.name, cust2.name) as nameSimilarity
ORDER BY nameSimilarity DESC
LIMIT 20
```

### 10.6 LLM Agent Memory Systems

**Pattern:** Neo4j stores agent memory as knowledge graphs

```cypher
-- Create semantic memory for agent
CREATE (memory:Memory {id: $id, timestamp: now()})
CREATE (memory)-[:REFERENCES]->(concept:Concept {name: $concept})
CREATE (memory)-[:CONTAINS]->(fact:Fact {content: $content})
CREATE (concept)-[:RELATED_TO]->(relatedConcept:Concept)

-- Query agent memory for context
MATCH (fact:Fact)<-[:CONTAINS]-(memory:Memory)
MATCH (memory)-[:REFERENCES]->(concept:Concept)
WHERE concept.name IN $relevantConcepts
RETURN memory, concept, fact
ORDER BY memory.timestamp DESC
LIMIT 5
```

---

## 11. Neo4j + AI/LLM Integration

### 11.1 GraphRAG Pattern

**What is GraphRAG:** Combines graph databases with vector embeddings for better RAG systems.

**Traditional Vector RAG Limitations:**
- Only semantic similarity (embeddings)
- Loses explicit relationships
- Can return redundant information
- Less explainable

**GraphRAG Advantages:**
- Semantic similarity (embeddings) + explicit relationships
- Multi-hop reasoning
- Better context gathering
- Explainable answers with relationship paths
- Reduces hallucinations through structural constraints

### 11.2 Neo4j Vector Search (Neo4j 5.0+)

Neo4j now includes **native vector indexing** with HNSW (Hierarchical Navigable Small World) algorithm:

```typescript
// Create vector index
const setupResult = await session.executeWrite(async (tx) => {
  return await tx.run(`
    CREATE VECTOR INDEX document_embeddings IF NOT EXISTS
    FOR (d:Document) ON (d.embedding)
    OPTIONS {indexConfig: {
      \`vector.dimensions\`: 1536,
      \`vector.similarity_function\`: 'cosine'
    }}
  `);
});

// Store document with embedding
const embedding = await generateEmbedding('text content');
await session.executeWrite(async (tx) => {
  return await tx.run(`
    CREATE (d:Document {
      id: $id,
      text: $text,
      embedding: $embedding,
      source: $source
    })
  `, {
    id: crypto.randomUUID(),
    text: 'document text',
    embedding: embedding,  // 1536-dimensional float array
    source: 'website'
  });
});

// Vector similarity search
const similarDocs = await session.executeRead(async (tx) => {
  return await tx.run(`
    WITH $embedding as queryEmbedding
    CALL db.index.vector.queryNodes('document_embeddings', 10, queryEmbedding)
    YIELD node as doc, score
    RETURN doc, score
    ORDER BY score DESC
  `, { embedding: queryEmbedding });
});
```

### 11.3 GraphRAG Implementation Pattern

```typescript
interface GraphRAGConfig {
  llmModel: 'gpt-4' | 'claude-3' | 'gemini';
  embeddingModel: 'text-embedding-3-large' | 'jina-embeddings-v2';
  vectorDimension: number;
  similarityThreshold: number;
}

async function graphRAGQuery(
  driver: Driver,
  userQuery: string,
  config: GraphRAGConfig
): Promise<string> {
  const session = driver.session();

  try {
    // Step 1: Get query embedding
    const queryEmbedding = await embedText(userQuery, config.embeddingModel);

    // Step 2: Vector search for relevant documents
    const vectorResults = await session.executeRead(async (tx) => {
      return await tx.run(`
        WITH $embedding as queryEmbedding
        CALL db.index.vector.queryNodes('document_embeddings', 5, queryEmbedding)
        YIELD node as doc, score
        WHERE score > $threshold
        RETURN doc, score
        ORDER BY score DESC
      `, {
        embedding: queryEmbedding,
        threshold: config.similarityThreshold
      });
    });

    // Step 3: Expand context through relationships (multi-hop)
    const expandedContext = await session.executeRead(async (tx) => {
      const docIds = vectorResults.records.map(r => r.get('doc').identity);
      return await tx.run(`
        UNWIND $docIds as docId
        MATCH (doc)-[:RELATED_TO|MENTIONS|CITES]->(relatedDoc)
        RETURN doc, relatedDoc
        UNION
        UNWIND $docIds as docId
        MATCH (doc)<-[:MENTIONS|CITES]-(relatedDoc)
        RETURN doc, relatedDoc
      `, { docIds });
    });

    // Step 4: Compile context for LLM
    const contextDocs = [
      ...vectorResults.records,
      ...expandedContext.records
    ];

    const context = contextDocs
      .map(r => r.get('doc').properties.text)
      .join('\n\n---\n\n');

    // Step 5: Generate answer with LLM
    const answer = await callLLM(config.llmModel, {
      systemPrompt: 'Answer based on the provided context. If unsure, say so.',
      userMessage: userQuery,
      context: context
    });

    return answer;

  } finally {
    await session.close();
  }
}
```

### 11.4 Knowledge Graph Construction from Unstructured Data

Neo4j provides the **LLM Graph Builder** for automatically extracting graphs from documents:

```typescript
// Manual knowledge graph construction pattern
async function extractEntitiesAndRelationships(
  driver: Driver,
  text: string,
  llmModel: string
) {
  const session = driver.session();

  try {
    // Use LLM to extract structured information
    const extracted = await callLLM(llmModel, {
      systemPrompt: `Extract entities and relationships from text.
        Return JSON: {
          entities: [{type, name, description}],
          relationships: [{source, target, type, strength}]
        }`,
      userMessage: text
    });

    const { entities, relationships } = JSON.parse(extracted);

    // Create nodes
    for (const entity of entities) {
      await session.executeWrite(async (tx) => {
        return await tx.run(`
          CREATE (n:${entity.type} {
            name: $name,
            description: $description
          })
          RETURN n
        `, {
          name: entity.name,
          description: entity.description
        });
      });
    }

    // Create relationships
    for (const rel of relationships) {
      await session.executeWrite(async (tx) => {
        return await tx.run(`
          MATCH (source)-[:TYPE {type: $type}]-(target)
          WHERE source.name = $source AND target.name = $target
          SET rel.strength = $strength
          RETURN rel
        `, rel);
      });
    }
  } finally {
    await session.close();
  }
}
```

### 11.5 LLM Knowledge Graph Validation

```cypher
-- Find inconsistencies in knowledge graph
MATCH (person:Person)-[:LIVES_IN]->(city:City)
MATCH (person)-[:WORKS_IN]->(workplace:City)
WHERE city <> workplace AND NOT (city)-[:CONNECTED_TO]-(workplace)
RETURN person, city, workplace

-- Find contradictions
MATCH (person)-[:KNOWS]->(friend)
MATCH (friend)-[:PARENT_OF]->(child)
MATCH (person)-[:SAME_AGE_AS]->(child)
RETURN person, friend, child  -- These should be warnings
```

---

## 12. Ecosystem Tools

### 12.1 APOC (Awesome Procedures on Cypher)

APOC is a library of 200+ procedures for extending Cypher's capabilities.

**Installation:** Included with Neo4j Enterprise and available for Community via download

**Common Functions:**

```cypher
-- String operations
WITH apoc.text.distance("Alice", "Alicia") as dist  -- Levenshtein distance
RETURN dist;

-- JSON handling
WITH apoc.convert.toMap('{"key": "value"}') as json
RETURN json.key;

-- HTTP requests
CALL apoc.load.json('https://api.example.com/data') YIELD value
RETURN value;

-- Graph algorithms
CALL apoc.algo.pageRank(null) YIELD node, score
RETURN node.name, score
ORDER BY score DESC
LIMIT 10;

-- UUID generation
WITH apoc.create.uuid() as id
CREATE (n:Node {id: id})
RETURN n;
```

**TypeScript Integration:**
```typescript
// APOC procedures are called via regular Cypher
const results = await session.executeRead(async (tx) => {
  return await tx.run(`
    WITH apoc.text.distance($text1, $text2) as distance
    RETURN distance
  `, { text1: 'Alice', text2: 'Alicia' });
});
```

### 12.2 Neo4j Graph Data Science Library (GDS)

Library of 65+ graph algorithms for analysis and ML.

**Installation:** Available in Neo4j Desktop and as plugin

**Algorithm Categories:**

- **Centrality:** PageRank, Betweenness, Closeness, Degree, Eigenvector
- **Community Detection:** Louvain, LPA, K-Clique
- **Similarity:** Cosine, Jaccard, Euclidean, Overlap
- **Pathfinding:** Shortest path, All-pairs shortest path, Dijkstra
- **Link Prediction:** Common neighbors, Preferential attachment

**Example Usage:**

```cypher
-- Project graph into memory
CALL gds.graph.project(
  'my-graph',
  'Person',
  'KNOWS',
  { relationshipProperties: ['weight'] }
)

-- Run PageRank algorithm
CALL gds.pageRank.stream('my-graph')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name, score
ORDER BY score DESC

-- Community detection
CALL gds.louvain.stream('my-graph')
YIELD nodeId, communityId
RETURN gds.util.asNode(nodeId).name, communityId
ORDER BY communityId
```

### 12.3 Neo4j Bloom (Visualization)

No-code visual graph explorer for non-technical users.

**Features:**
- Drag-and-drop graph visualization
- Pattern-based search interface
- Interactive relationship exploration
- Custom styling and perspectives
- Integration with GDS results

**TypeScript Integration:** Bloom is a UI tool, accessed via browser. No SDK integration needed.

### 12.4 Neo4j Browser

Built-in web interface for query development.

**Access:** `http://localhost:7474` (default)

**Features:**
- Cypher query editor with autocomplete
- Results visualization (graph, table, code)
- Query history
- Database statistics
- Server monitoring

### 12.5 Neo4j Desktop

Local development environment for Mac/Linux/Windows.

**Features:**
- Project management
- One-click database creation
- Multiple version support
- Browser integration
- Backup/restore utilities

---

## 13. Bun/TypeScript Implementation Patterns

### 13.1 Connection Pooling Pattern

```typescript
import neo4j, { Driver, Session } from 'neo4j-driver';

class Neo4jPool {
  private driver: Driver;
  private sessionCache: Map<string, Session> = new Map();

  constructor(uri: string, auth: any, config: any) {
    this.driver = neo4j.driver(uri, auth, config);
  }

  async getSession(key: string = 'default'): Promise<Session> {
    let session = this.sessionCache.get(key);

    if (!session) {
      session = this.driver.session();
      this.sessionCache.set(key, session);
    }

    return session;
  }

  async closeAll(): Promise<void> {
    for (const session of this.sessionCache.values()) {
      await session.close();
    }
    this.sessionCache.clear();
    await this.driver.close();
  }
}

// Usage in Bun
const pool = new Neo4jPool(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'password'),
  { maxConnectionPoolSize: 10 }
);

const session = await pool.getSession();
// ... use session

// On app shutdown
await pool.closeAll();
```

### 13.2 Repository Pattern

```typescript
interface Repository<T> {
  create(item: T): Promise<T>;
  read(id: string): Promise<T | null>;
  update(id: string, item: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
  list(limit: number): Promise<T[]>;
}

class PersonRepository implements Repository<Person> {
  constructor(private driver: Driver) {}

  async create(person: Person): Promise<Person> {
    const session = this.driver.session();
    try {
      const result = await session.executeWrite(async (tx) => {
        return await tx.run(
          `CREATE (p:Person {id: $id, name: $name, age: $age}) RETURN p`,
          person
        );
      });
      return result.records[0].get('p').properties as Person;
    } finally {
      await session.close();
    }
  }

  async read(id: string): Promise<Person | null> {
    const session = this.driver.session();
    try {
      const result = await session.executeRead(async (tx) => {
        return await tx.run(
          'MATCH (p:Person {id: $id}) RETURN p',
          { id }
        );
      });
      if (result.records.length === 0) return null;
      return result.records[0].get('p').properties as Person;
    } finally {
      await session.close();
    }
  }

  async update(id: string, updates: Partial<Person>): Promise<Person> {
    const session = this.driver.session();
    try {
      const props = Object.entries(updates)
        .map(([key, val], i) => `p.${key} = $${key}`)
        .join(', ');

      const result = await session.executeWrite(async (tx) => {
        return await tx.run(
          `MATCH (p:Person {id: $id}) SET ${props} RETURN p`,
          { id, ...updates }
        );
      });
      return result.records[0].get('p').properties as Person;
    } finally {
      await session.close();
    }
  }

  async delete(id: string): Promise<boolean> {
    const session = this.driver.session();
    try {
      const result = await session.executeWrite(async (tx) => {
        return await tx.run(
          'MATCH (p:Person {id: $id}) DELETE p RETURN count(p) as deleted',
          { id }
        );
      });
      return result.records[0].get('deleted').toNumber() > 0;
    } finally {
      await session.close();
    }
  }

  async list(limit: number = 100): Promise<Person[]> {
    const session = this.driver.session();
    try {
      const result = await session.executeRead(async (tx) => {
        return await tx.run(
          'MATCH (p:Person) RETURN p LIMIT $limit',
          { limit }
        );
      });
      return result.records.map(r => r.get('p').properties as Person);
    } finally {
      await session.close();
    }
  }
}

// Usage
const personRepo = new PersonRepository(driver);

const newPerson = await personRepo.create({
  id: 'person-1',
  name: 'Alice',
  age: 30
});

const found = await personRepo.read('person-1');

await personRepo.update('person-1', { age: 31 });

await personRepo.delete('person-1');
```

### 13.3 Dependency Injection Pattern

```typescript
interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
}

class Neo4jModule {
  private driver: Driver;

  constructor(config: Neo4jConfig) {
    this.driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.username, config.password)
    );
  }

  getDriver(): Driver {
    return this.driver;
  }

  async shutdown(): Promise<void> {
    await this.driver.close();
  }
}

// Application bootstrap
const config: Neo4jConfig = {
  uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
  username: process.env.NEO4J_USER || 'neo4j',
  password: process.env.NEO4J_PASSWORD || 'password'
};

const neo4j = new Neo4jModule(config);
const personRepo = new PersonRepository(neo4j.getDriver());

// Bun server example
export default {
  fetch(req: Request) {
    // Handle requests with personRepo
    return new Response('OK');
  },

  shutdown() {
    return neo4j.shutdown();
  }
};
```

### 13.4 Error Handling and Retry Logic

```typescript
interface RetryConfig {
  maxRetries: number;
  delayMs: number;
  backoffMultiplier: number;
}

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = { maxRetries: 3, delayMs: 100, backoffMultiplier: 2 }
): Promise<T> {
  let lastError: Error | null = null;
  let delay = config.delayMs;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on non-retryable errors
      if (error instanceof neo4j.error.Neo4jError) {
        if (error.code === 'Neo.ClientError.Transaction.LockClientStopped') {
          throw error; // Don't retry
        }
      }

      if (attempt < config.maxRetries) {
        console.log(`Retry attempt ${attempt + 1}/${config.maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= config.backoffMultiplier;
      }
    }
  }

  throw new Error(`Operation failed after ${config.maxRetries} retries: ${lastError?.message}`);
}

// Usage
const person = await executeWithRetry(
  () => personRepo.read('person-1'),
  { maxRetries: 5, delayMs: 200, backoffMultiplier: 1.5 }
);
```

### 13.5 Testing Pattern with Bun

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import neo4j from 'neo4j-driver';

describe('PersonRepository', () => {
  let driver: Driver;
  let repo: PersonRepository;

  beforeAll(async () => {
    driver = neo4j.driver(
      'bolt://localhost:7687',
      neo4j.auth.basic('neo4j', 'password')
    );
    repo = new PersonRepository(driver);

    // Clear test data
    const session = driver.session();
    await session.executeWrite(async (tx) => {
      return await tx.run('MATCH (p:Person) WHERE p.testId = "test" DELETE p');
    });
    await session.close();
  });

  afterAll(async () => {
    const session = driver.session();
    await session.executeWrite(async (tx) => {
      return await tx.run('MATCH (p:Person) WHERE p.testId = "test" DELETE p');
    });
    await session.close();
    await driver.close();
  });

  it('should create a person', async () => {
    const person = await repo.create({
      id: 'test-1',
      name: 'Test Person',
      age: 25,
      testId: 'test'
    });

    expect(person.name).toBe('Test Person');
    expect(person.age).toBe(25);
  });

  it('should read a person', async () => {
    await repo.create({
      id: 'test-2',
      name: 'Read Test',
      age: 30,
      testId: 'test'
    });

    const person = await repo.read('test-2');
    expect(person).not.toBeNull();
    expect(person?.name).toBe('Read Test');
  });
});
```

---

## Summary and Recommendations

### Key Findings

1. **Neo4j + Bun Compatibility:** Works well with neo4j-driver, evidenced by active GraphRAG projects in Bun/TypeScript

2. **Deployment Options:** AuraDB (managed cloud) recommended for production; Docker for self-hosted flexibility; Neo4j Desktop for local development

3. **Performance:** Neo4j excels at relationship-heavy queries; constant-time traversal makes it ideal for knowledge graphs and recommendation engines

4. **AI/LLM Integration:** Vector search + knowledge graph combination (GraphRAG) provides better RAG than embeddings alone

5. **Ecosystem:** APOC (procedures), GDS (algorithms), and Bloom (visualization) extend Neo4j capabilities significantly

6. **TypeScript Support:** First-class support in neo4j-driver with modern async/await patterns

### Recommendation for SAM Integration

For your SAM system's memory/knowledge graph needs:

1. **Use Neo4j for agent memory:** Store semantic relationships between concepts, facts, and contexts
2. **Implement GraphRAG pattern:** Combine vector search with explicit relationships for better LLM context
3. **Deployment:** Use Docker locally during development, consider AuraDB for multi-agent systems
4. **Driver:** neo4j-driver in Bun works reliably; use connection pooling for efficiency
5. **Patterns:** Repository pattern for CRUD, DI for configuration, retry logic for reliability

### Reference Links

**Documentation:**
- [Neo4j Graph Database Concepts](https://neo4j.com/docs/getting-started/appendix/graphdb-concepts/)
- [Cypher Query Language Manual](https://neo4j.com/docs/cypher-manual/current/)
- [Neo4j JavaScript Driver](https://neo4j.com/docs/javascript-manual/current/)
- [Neo4j GraphQL Library](https://neo4j.com/docs/graphql/current/)

**Implementation Examples:**
- [GraphAcademy TypeScript Course](https://graphacademy.neo4j.com/courses/app-typescript/)
- [GraphRAG + Bun Implementation](https://github.com/alexy-os/graphrag)
- [Neo4j Examples Repository](https://github.com/neo4j-examples/)

**Advanced Topics:**
- [Neo4j GraphRAG Tutorial](https://neo4j.com/blog/developer/rag-tutorial/)
- [Neo4j Graph Data Science](https://neo4j.com/docs/graph-data-science/current/)
- [APOC Procedures Library](https://neo4j.com/docs/apoc/current/)

---

**Report Generated:** 2026-03-15
**Status:** Ready for implementation and reference
