# AI Technical Spec Mapper (Shopware 6)

## 1. Project Overview

### Goal

Create a Shopware 6 plugin that uses AI to read messy supplier product data and propose correct updates to existing product properties in the Shopware database.

This is a hackathon-v1 feature intended to be explored and prototyped within about 6 hours. The priority is to build a small, demoable workflow while learning how to collaborate effectively with Codex AI during planning, implementation, debugging, and review.

### Problem Statement

Suppliers often send product updates through PDFs, emails, or spreadsheet exports. Moving this information into Shopware is usually a slow manual copy-paste process. Standard import tools work poorly when supplier terms do not exactly match the shop's property names or value formats.

Examples:

- `Mass` should map to `Weight`
- `Operating Tension` should map to `Voltage`
- `Sức chịu tải` should map to `Load Capacity`
- `800g` may need to be normalized to `0.8kg`

### Desired Outcome

An admin user can paste raw supplier text into the Shopware Administration, let AI analyze it, review a proposed comparison of current vs new values, and approve the final property updates before anything is saved.

## 2. Scope And Success Criteria

### In Scope

- one Admin-only workflow
- focus on basic scenarios only
- text input pasted from PDF, email, or Excel
- basic file understanding for uploaded PDF, Excel, or DOCX files
- product identification using `product_number`
- AI-assisted extraction of technical attributes and values
- synonym mapping against existing Shopware property groups/options
- comparison against current product properties
- simple and easy-to-use review UI before saving
- manual user approval before persistence
- DAL-based read and update flow for product property assignments

### Out Of Scope

- advanced PDF parsing
- advanced Excel parsing
- advanced DOCX parsing
- OCR
- automatic creation of new property groups
- automatic creation of new property options
- background jobs or batch import flows
- production-ready confidence calibration
- full automation without review
- perfect extraction from all supplier file layouts

### Definition Of Success

The hackathon is successful if the prototype can demonstrate the following:

- a user can provide supplier content by paste or basic file upload
- the system identifies the target product from `product_number`
- the system proposes mapped technical property changes
- the UI clearly shows `Add`, `Update`, `Ignore`, or `Needs Review`
- the UI is easy to interact with during review
- the user can review the proposal before saving
- the work helps improve hands-on Codex collaboration skills

### Realistic 6-Hour MVP

To keep this achievable within one hackathon session, the MVP should intentionally support only the simplest demo path:

- support paste-first input as the primary path
- support basic file upload as a secondary path for a small set of happy-case files
- treat file upload as a conversion step into plain text for AI processing
- support only a few common technical attributes in the demo, such as Weight, Voltage, Material, and Load Capacity
- support only one product at a time
- support only existing property groups and existing property options
- allow simple manual rework in the review modal rather than building a complex correction workflow
- use a simulated or coarse-grained loading percentage if exact progress tracking is too expensive for the prototype
- prefer a stable demo with 3-5 reliable examples over broad format coverage

## 3. User Flow

1. An admin opens the plugin page in Shopware Administration.
2. The admin either pastes raw supplier text or uploads a supported file.
3. The plugin sends the text for AI-assisted extraction and mapping.
4. The system identifies the product by `product_number`.
5. The system compares extracted values with the product's current property assignments.
6. The UI shows loading progress while the input is being processed.
7. A review table or modal shows the proposed result for each mapped item in a structured format.
8. The admin can double-check and rework the data if needed.
9. The admin approves the result before any update is written to the database.

## 4. Functional Requirements

### A. Input And Product Identification

#### Data Input

The plugin must provide a simple Admin input flow where a user can either paste text or upload a supported file.

Supported input methods for the hackathon prototype:

- PDF content
- email content
- Excel content copied as plain text
- uploaded PDF files
- uploaded Excel files
- uploaded DOCX files

The implementation should focus on the most basic file-understanding scenarios only. It is acceptable if the prototype supports limited formats, simplified parsing, or partial success for messy documents, as long as the flow is demoable.

For the MVP, paste input is the primary reliable path. File upload is a bonus capability and may be limited to basic text extraction from simple files.

#### Product Match

The system must identify the target product by finding `product_number` inside the pasted text.

`product_number` is the source of truth for product matching in v1. If no reliable product match is found, the result must be marked as `Needs Review` and must not be auto-saved.

### B. AI Mapping Engine

#### Attribute Extraction

The AI must extract technical attribute/value candidates from messy supplier text, such as:

- `1.5kg`
- `220V`
- `Steel`
- `Stainless Steel`

#### Synonym Mapping

The AI must recognize supplier terminology and map it to the shop's existing property groups and property options.

Examples:

- `Mass` -> `Weight`
- `Operating Tension` -> `Voltage`
- `Sức chịu tải` -> `Load Capacity`

This mapping should be based on the shop's existing property model. In v1, only existing property groups/options are valid auto-save targets.

#### Change Detection

The system must compare the extracted new values with the product's current property assignments in Shopware.

#### Unit Normalization

The system should normalize units before comparison when reasonable for the v1 prototype.

Example:

- `800g` -> `0.8kg`

#### Confidence Classification

Each proposed result must be labeled with one of these confidence levels:

- `High Confidence`
- `Needs Review`

Numeric confidence thresholds are not required in v1.

### C. Review And Approval

#### Comparison UI

The Admin UI must display a review table before saving any updates.

The table should include at least these columns:

- property
- current value
- proposed value
- action type
- confidence
- status or review note

The UI should use standard Shopware Administration components and keep a native look by using:

- `sw-card`
- `sw-data-grid`

The UI/UX should be easy to interact with and should include:

- a file upload control for PDF, Excel, and DOCX input
- a visible loading indicator with percentage progress while processing
- a modal that shows the formatted extracted data so users can double-check and rework it if needed before final approval

For the hackathon version, the interaction model should stay lightweight:

- upload a file or paste text
- click analyze
- wait for progress feedback
- review formatted output in a modal
- confirm the proposed table rows before saving

#### Action Types

The system must classify each result using the following action types:

- `Add`: the mapped property option already exists in Shopware but is not yet assigned to the product
- `Update`: the mapped property value differs from the currently assigned value
- `Ignore`: the current value already matches the proposed value
- `Needs Review`: the product match is unclear, the synonym mapping is unclear, the option does not exist, or the result is otherwise low confidence

#### Save Rule

No database change should happen before explicit user review and approval.

## 5. Technical Constraints

### Hackathon Constraints

This specification is intentionally limited to fit a 6-hour hackathon implementation window.

- basic scenarios only
- minimal file understanding for PDF, Excel, and DOCX
- no advanced OCR pipeline
- no large refactors
- one main Admin workflow only
- prioritize demoability over completeness
- optimize for the simplest believable end-to-end demo

### Platform Constraints

- the feature should be implemented as a Shopware 6 plugin
- the UI should live in Shopware Administration
- product data access and updates should use the Shopware DAL
- product property updates should target the product-property relation using existing Shopware data

### AI Model Constraint

Use `gpt-4o-mini` for the v1 prototype because it is fast and low cost.

## 6. Technical Behavior Summary

### Admin Surface

The plugin should provide one simple Admin page containing:

- a text area for supplier input
- a file upload control for supported document formats
- a trigger action to analyze the text
- a loading indicator with percentage progress
- a review table for proposed changes
- a modal for formatted extracted data preview and rework
- an approval step before persistence

The recommended MVP delivery order is:

1. paste text input
2. review grid
3. approval flow
4. loading indicator
5. modal rework step
6. file upload support

### Backend Surface

The plugin is expected to use one plugin-owned processing flow for analysis and comparison. This requirement document intentionally stays at behavior level and does not define the route structure yet.

### Data Handling Rules

- `product_number` is the required product matching key
- current Shopware product properties are the source of truth for comparison
- only existing property groups/options are valid update targets in v1
- unknown values should not create new options automatically
- unknown or ambiguous results must be marked `Needs Review`

## 7. Example Test Scenarios

### Update Scenario

Raw input text:

`Model-X is now 1.5kg.`

Expected result:

- the product is matched using `product_number`
- the value is interpreted as `Weight`
- the comparison result is `Update`
- the proposed value is `1.5kg`

### Add Scenario

Raw input text:

`Material: Stainless Steel.`

Expected result:

- if `Stainless Steel` already exists as a Shopware property option, the result is `Add`
- if the option does not exist, the result is `Needs Review`

### Synonym Scenario

Raw input text:

`Operating Tension: 220V.`

Expected result:

- `Operating Tension` is mapped to `Voltage`
- the proposed value is `220V`
- the result is classified according to current database state

### Ignore Scenario

Raw input text:

Supplier text contains a value that already matches the current product property value in Shopware.

Expected result:

- the row is marked `Ignore`

### Low-Confidence Scenario

Raw input text:

The text is ambiguous or does not contain a reliable `product_number`.

Expected result:

- the result is marked `Needs Review`
- the system does not auto-save anything

### File Upload Scenario

Raw input:

The user uploads a supported PDF, Excel, or DOCX file with basic technical product data.

Expected result:

- the file content is converted into processable text or structured input
- the UI shows loading progress with a percentage
- the extracted structured result is shown in a modal for double-checking
- the user can rework the formatted data before approval

## 8. Delivery Breakdown

### Must Have

- one Admin page in the plugin
- text area for pasted supplier content
- AI analysis using `gpt-4o-mini`
- product matching by `product_number`
- comparison table with `Add`, `Update`, `Ignore`, and `Needs Review`
- manual approval before save

### Should Have

- file upload for at least one simple supported format
- loading indicator with visible percentage
- modal showing formatted extracted data before approval

### Nice To Have

- support for PDF, Excel, and DOCX in the same demo
- editable structured fields inside the modal
- stronger unit normalization coverage
- better synonym coverage for multilingual supplier input

## 9. Codex Learning Goal

The main personal goal of this hackathon is to learn how to work effectively with Codex AI while building a real Shopware prototype.

Codex should be used for:

- exploring Shopware extension points
- breaking the feature into small implementation steps
- explaining DAL and Administration patterns
- drafting safe incremental edits
- reviewing each milestone for bugs, risks, and missing cases

### Compact 6-Hour Codex Plan

#### Hour 1

- refine the feature scope
- ask Codex to identify the best plugin/Admin entry points

#### Hour 2

- ask Codex to inspect relevant Shopware DAL and Admin patterns
- locate product property update flows and UI examples

#### Hour 3-4

- implement the smallest working happy path
- use Codex for step-by-step edits and explanations

#### Hour 5

- review and debug the main flow with Codex
- validate the most important cases only

#### Hour 6

- prepare a short demo
- note what worked, what was incomplete, and what was learned about prompting Codex

## 10. Final Notes

This document defines a narrow v1 for a hackathon. It is not a production-ready RFC.

The first version should focus on basic scenarios, correctness of the review flow, and clarity of the proposal UI, not on complete automation or complete feature coverage.
