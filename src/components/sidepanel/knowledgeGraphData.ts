export const knowledgeGraphData = {
  nodes: [
    // Research & Learning Cluster
    { id: "Research & Learning", category: "Research" },
    { id: "Google Docs", category: "Research" },
    { id: "Wikipedia", category: "Research" },
    { id: "Stack Overflow", category: "Research" },
    { id: "MDN Web Docs", category: "Research" },
    { id: "GitHub", category: "Research" },

    // Shopping & E-commerce Cluster
    { id: "Shopping & E-commerce", category: "Shopping" },
    { id: "Amazon", category: "Shopping" },
    { id: "Flipkart", category: "Shopping" },
    { id: "eBay", category: "Shopping" },
    { id: "Product Reviews", category: "Shopping" },
    { id: "Price Comparison", category: "Shopping" },

    // Development & Tools Cluster
    { id: "Development Tools", category: "Development" },
    { id: "VS Code", category: "Development" },
    { id: "Figma Design", category: "Development" },
    { id: "Slack Communication", category: "Development" },
    { id: "Jira Project Management", category: "Development" },
    { id: "NPM Registry", category: "Development" },

    // Entertainment & Media Cluster
    { id: "Entertainment & Media", category: "Entertainment" },
    { id: "YouTube", category: "Entertainment" },
    { id: "Netflix", category: "Entertainment" },
    { id: "Twitter/X", category: "Entertainment" },
    { id: "Reddit", category: "Entertainment" },
    { id: "News Sites", category: "Entertainment" },

    // Productivity & Organization Cluster
    { id: "Productivity Tools", category: "Productivity" },
    { id: "Notion", category: "Productivity" },
    { id: "Google Calendar", category: "Productivity" },
    { id: "Asana", category: "Productivity" },
    { id: "Email", category: "Productivity" },
    { id: "Cloud Storage", category: "Productivity" },

    // Health & Wellness Cluster
    { id: "Health & Wellness", category: "Health" },
    { id: "Fitness Apps", category: "Health" },
    { id: "Nutrition Info", category: "Health" },
    { id: "Medical Resources", category: "Health" },
    { id: "Mental Health", category: "Health" },
  ],
  links: [
    // Research cluster internal
    { source: "Research & Learning", target: "Google Docs" },
    { source: "Research & Learning", target: "Wikipedia" },
    { source: "Research & Learning", target: "Stack Overflow" },
    { source: "Research & Learning", target: "MDN Web Docs" },
    { source: "Research & Learning", target: "GitHub" },
    { source: "Google Docs", target: "Stack Overflow" },
    { source: "GitHub", target: "Stack Overflow" },
    { source: "MDN Web Docs", target: "Google Docs" },

    // Shopping cluster internal
    { source: "Shopping & E-commerce", target: "Amazon" },
    { source: "Shopping & E-commerce", target: "Flipkart" },
    { source: "Shopping & E-commerce", target: "eBay" },
    { source: "Shopping & E-commerce", target: "Product Reviews" },
    { source: "Shopping & E-commerce", target: "Price Comparison" },
    { source: "Amazon", target: "Product Reviews" },
    { source: "Flipkart", target: "Price Comparison" },
    { source: "eBay", target: "Product Reviews" },

    // Development cluster internal
    { source: "Development Tools", target: "VS Code" },
    { source: "Development Tools", target: "Figma Design" },
    { source: "Development Tools", target: "Slack Communication" },
    { source: "Development Tools", target: "Jira Project Management" },
    { source: "Development Tools", target: "NPM Registry" },
    { source: "VS Code", target: "NPM Registry" },
    { source: "Figma Design", target: "Slack Communication" },
    { source: "Jira Project Management", target: "Slack Communication" },

    // Entertainment cluster internal
    { source: "Entertainment & Media", target: "YouTube" },
    { source: "Entertainment & Media", target: "Netflix" },
    { source: "Entertainment & Media", target: "Twitter/X" },
    { source: "Entertainment & Media", target: "Reddit" },
    { source: "Entertainment & Media", target: "News Sites" },
    { source: "YouTube", target: "Netflix" },
    { source: "Twitter/X", target: "Reddit" },
    { source: "Reddit", target: "News Sites" },

    // Productivity cluster internal
    { source: "Productivity Tools", target: "Notion" },
    { source: "Productivity Tools", target: "Google Calendar" },
    { source: "Productivity Tools", target: "Asana" },
    { source: "Productivity Tools", target: "Email" },
    { source: "Productivity Tools", target: "Cloud Storage" },
    { source: "Notion", target: "Asana" },
    { source: "Google Calendar", target: "Email" },
    { source: "Asana", target: "Cloud Storage" },

    // Health cluster internal
    { source: "Health & Wellness", target: "Fitness Apps" },
    { source: "Health & Wellness", target: "Nutrition Info" },
    { source: "Health & Wellness", target: "Medical Resources" },
    { source: "Health & Wellness", target: "Mental Health" },
    { source: "Fitness Apps", target: "Nutrition Info" },
    { source: "Medical Resources", target: "Mental Health" },

    // Cross-cluster connections (user navigation patterns)
    { source: "Google Docs", target: "Notion" },
    { source: "GitHub", target: "VS Code" },
    { source: "Stack Overflow", target: "NPM Registry" },
    { source: "Slack Communication", target: "Email" },
    { source: "YouTube", target: "Google Docs" },
    { source: "Product Reviews", target: "YouTube" },
    { source: "Fitness Apps", target: "YouTube" },
  ],
}
