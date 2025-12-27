export interface KnowledgeNode {
  id: string
  label: string
  category: string
  description?: string
}

export interface KnowledgeLink {
  source: string
  target: string
  type: "prerequisite" | "related" | "component" | "builds-on"
}

export interface KnowledgeGraphData {
  nodes: KnowledgeNode[]
  links: KnowledgeLink[]
}

export const KNOWLEDGE_GRAPH_DATA: KnowledgeGraphData = {
  nodes: [
    // Fundamentals
    {
      id: "variables",
      label: "Variables & Data Types",
      category: "Fundamentals",
      description: "Understanding variables, primitive types, and type systems",
    },
    {
      id: "control-flow",
      label: "Control Flow",
      category: "Fundamentals",
      description: "Conditionals, loops, and program flow management",
    },
    {
      id: "functions",
      label: "Functions & Methods",
      category: "Fundamentals",
      description: "Function definition, parameters, return values, and scope",
    },
    {
      id: "oop",
      label: "Object-Oriented Programming",
      category: "Fundamentals",
      description: "Classes, objects, inheritance, and polymorphism",
    },
    {
      id: "recursion",
      label: "Recursion",
      category: "Fundamentals",
      description: "Recursive function calls, base cases, and stack frames",
    },

    // Data Structures
    {
      id: "arrays",
      label: "Arrays & Lists",
      category: "Data Structures",
      description: "Linear collections with indexed access",
    },
    {
      id: "linked-lists",
      label: "Linked Lists",
      category: "Data Structures",
      description: "Sequential data structure with node-based storage",
    },
    {
      id: "stacks",
      label: "Stacks",
      category: "Data Structures",
      description: "LIFO (Last-In-First-Out) data structure",
    },
    {
      id: "queues",
      label: "Queues",
      category: "Data Structures",
      description: "FIFO (First-In-First-Out) data structure",
    },
    {
      id: "trees",
      label: "Trees",
      category: "Data Structures",
      description: "Hierarchical data structure with nodes and branches",
    },
    {
      id: "graphs",
      label: "Graphs",
      category: "Data Structures",
      description: "Non-linear data structure with nodes and edges",
    },
    {
      id: "hash-tables",
      label: "Hash Tables",
      category: "Data Structures",
      description: "Key-value storage with hash function mapping",
    },

    // Algorithms
    {
      id: "sorting",
      label: "Sorting Algorithms",
      category: "Algorithms",
      description: "Arranging elements in order (bubble, quick, merge sort)",
    },
    {
      id: "searching",
      label: "Searching Algorithms",
      category: "Algorithms",
      description: "Finding elements (linear, binary search)",
    },
    {
      id: "graph-traversal",
      label: "Graph Traversal",
      category: "Algorithms",
      description: "DFS and BFS for exploring graph structures",
    },
    {
      id: "dynamic-programming",
      label: "Dynamic Programming",
      category: "Algorithms",
      description: "Optimization technique using memoization and overlapping subproblems",
    },
    {
      id: "greedy",
      label: "Greedy Algorithms",
      category: "Algorithms",
      description: "Making locally optimal choices at each step",
    },

    // Advanced Topics
    {
      id: "complexity",
      label: "Time & Space Complexity",
      category: "Advanced Topics",
      description: "Big O notation and algorithm analysis",
    },
    {
      id: "design-patterns",
      label: "Design Patterns",
      category: "Advanced Topics",
      description: "Reusable solutions to common programming problems",
    },
    {
      id: "concurrency",
      label: "Concurrency & Threading",
      category: "Advanced Topics",
      description: "Parallel execution and thread management",
    },
  ],
  links: [
    // Fundamentals relationships
    { source: "variables", target: "control-flow", type: "prerequisite" },
    { source: "control-flow", target: "functions", type: "prerequisite" },
    { source: "functions", target: "recursion", type: "builds-on" },
    { source: "functions", target: "oop", type: "prerequisite" },
    { source: "variables", target: "oop", type: "prerequisite" },

    // Data Structures relationships
    { source: "arrays", target: "linked-lists", type: "related" },
    { source: "arrays", target: "sorting", type: "component" },
    { source: "linked-lists", target: "stacks", type: "component" },
    { source: "linked-lists", target: "queues", type: "component" },
    { source: "stacks", target: "recursion", type: "related" },
    { source: "queues", target: "graph-traversal", type: "related" },
    { source: "trees", target: "graphs", type: "related" },
    { source: "hash-tables", target: "graphs", type: "component" },
    { source: "arrays", target: "trees", type: "component" },

    // Algorithm relationships
    { source: "arrays", target: "searching", type: "prerequisite" },
    { source: "arrays", target: "sorting", type: "prerequisite" },
    { source: "sorting", target: "complexity", type: "related" },
    { source: "searching", target: "complexity", type: "related" },
    { source: "graphs", target: "graph-traversal", type: "prerequisite" },
    { source: "recursion", target: "dynamic-programming", type: "prerequisite" },
    { source: "recursion", target: "graph-traversal", type: "prerequisite" },
    { source: "trees", target: "dynamic-programming", type: "related" },
    { source: "arrays", target: "greedy", type: "related" },

    // Advanced topics relationships
    { source: "sorting", target: "complexity", type: "builds-on" },
    { source: "functions", target: "design-patterns", type: "prerequisite" },
    { source: "oop", target: "design-patterns", type: "prerequisite" },
    { source: "graph-traversal", target: "concurrency", type: "related" },
    { source: "dynamic-programming", target: "complexity", type: "component" },
  ],
}
