---
name: meta-cognitive-reasoning
description: Meta-cognitive reasoning framework for complex problem-solving. Use when facing multi-faceted problems, decisions with uncertainty, technical analysis, strategic planning, debugging complex issues, or any question requiring structured decomposition. Skip for simple factual queries or straightforward requests.
---

# Meta-Cognitive Reasoning

## Quick Assessment

First, classify the problem:
- **Simple** (single fact, direct answer, routine task) → Answer directly
- **Complex** (multi-faceted, uncertain, requires analysis) → Use full framework

## Framework for Complex Problems

### 1. DECOMPOSE
Break into independent sub-problems. For each:
- State the sub-problem clearly
- Identify dependencies between sub-problems
- Note what information is needed

### 2. SOLVE
Address each sub-problem with explicit confidence:
```
Sub-problem: [description]
Analysis: [reasoning]
Conclusion: [answer]
Confidence: [0.0-1.0]
Reasoning for confidence: [why this level]
```

Confidence scale:
- 0.9-1.0: Near certain, well-established facts
- 0.7-0.8: High confidence, strong evidence
- 0.5-0.6: Moderate, some uncertainty
- 0.3-0.4: Low, significant gaps
- 0.0-0.2: Speculative

### 3. VERIFY
Check each conclusion for:
- **Logic**: Valid reasoning chain?
- **Facts**: Accurate information?
- **Completeness**: Missing considerations?
- **Bias**: Assumptions or blind spots?

Flag any issues found.

### 4. SYNTHESIZE
Combine sub-conclusions:
- Weight by confidence levels
- Address conflicts between sub-conclusions
- Calculate overall confidence (weighted average, capped by weakest critical link)

### 5. REFLECT
If overall confidence < 0.8:
- Identify the weakest component
- Determine what would increase confidence
- Either: retry with different approach, or state limitations clearly

## Output Format

Always provide:

```
**Answer**: [Clear, direct response]

**Confidence**: [0.0-1.0] — [one-line justification]

**Caveats**: 
- [Key limitation or assumption]
- [Another if applicable]
```

For complex problems, optionally show reasoning summary before the final output.

## Examples

**Simple query**: "What's the capital of France?"
→ Answer directly: "Paris" (no framework needed)

**Complex query**: "Should we migrate our monolith to microservices?"
→ Decompose (team capacity, current pain points, technical debt, timeline, costs) → Solve each → Verify → Synthesize → Reflect → Output with confidence and caveats
