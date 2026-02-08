# The-Magic-Bean-Stock
### Magic you can measure!

## Team Members:
1. Nikki Azadi
2. Sydney Staggs
3. Dante Dunham

## Project Purpose:
The Magic Bean Stock web app was built to combat inefficient, wasteful inventory management in large-scale restaurants. It benefits the restaurant managers who utilize it and the community alike by finding sustainable alternatives to wasting product while also reducing the amount of waste. Magic Bean Stock analyzes sales trends in conjunction with current inventory and expiration dates to minimize waste and predict future orders' timing and amounts to avoid stockouts or overordering.

## Tools Utilized:
### Programming Languages:
* JavaScript / TypeScript - Power the core frontend logic and application state, with TypeScript providing type safety and better scalability as features grow.
* Python - Used for data analysis, forecasting logic, and prototyping inventory prediction models.
* HTML / CSS - Structure and style the user interface, ensuring accessibility and responsive layouts across devices.
### Frameworks / Libraries:
* Next.js - Serves as the primary web framework, enabling fast page loads, routing, and seamless integration with backend services.
* React - Provides a component-based architecture for building interactive dashboards and inventory management views.
* Tailwind - Allows rapid UI development with consistent, responsive styling and minimal custom CSS overhead.
### APIs & Services:
* Firebase - Handles authentication and application services, enabling secure user accounts and real-time data access.
* OpenAI API - Generates AI-driven insights such as reorder suggestions, waste-reduction strategies, and sustainability alternatives.
* Mapbox API - Supports location-based features, such as mapping nearby food banks for donations.
### Databases:
* Firestore - Stores inventory items, expiration dates, usage data, and user-specific settings in a scalable, real-time cloud database.
### Dev Tools:
* GitHub - Used for version control and team collaboration, allowing rapid iteration and coordinated development.
* Figma - Enabled collaborative UI/UX design and prototyping before implementation, ensuring a cohesive user experience.
### AI / ML Tools:
* OpenAI - Powers natural-language reasoning and contextual recommendations tailored to restaurant inventory needs.
* Sklearn - Used for experimenting with predictive models to forecast demand and estimate optimal reorder quantities.

## Obstacles Encountered:
1. Scope vs. Hackathon Reality  
    One of our main challenges was managing scope within the limited time of a hackathon. Magic Bean Stock brings together inventory tracking, expiration management, demand forecasting, sustainability insights, authentication, and AI-driven recommendations, which required careful prioritization to remain feasible.  
    Many of these features are tightly interconnected, meaning progress in one area depended on progress in others. To address this, we focused on establishing a strong core workflow (inventory data feeding into analysis and resulting in actionable recommendations) while designing additional features to be extensible beyond the initial prototype.
2. Inventory + Expiration Modeling  
    Another challenge was modeling inventory in a way that reflected real-world restaurant usage. Inventory management involves more than tracking item quantities; it also requires accounting for expiration dates, partial usage, overlapping stock batches, and projected sales.  
    Designing this data structure was challenging because early decisions directly impacted our ability to perform accurate analysis and predictions later on. We iterated on our inventory model to support time-based analysis while keeping the system flexible and scalable for future expansion.
3. Turning Sustainability Into Logic  
    A key challenge was translating sustainability goals into concrete system behavior. While reducing waste is a clear objective, implementing it required defining when inventory is considered at risk, what alternatives qualify as sustainable, and how recommendations should be prioritized.  
    This was challenging because there is no single correct solution; sustainability exists at the intersection of ethics, practicality, and business constraints. We focused on pragmatic sustainability by generating realistic, actionable recommendations that align with existing restaurant workflows rather than idealized solutions.

## Public Frameworks Used:
- OpenAI - Used to generate AI-powered insights for inventory forecasting, waste reduction strategies, and sustainable alternatives.
- Firebase - Provides authentication and cloud-based services for securely managing user accounts and application data.
- Mapbox API - Enables location-based visualization and mapping features to map nearby food banks for donations.  
All public frameworks were used in accordance with their respective usage policies