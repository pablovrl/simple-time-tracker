```mermaid
erDiagram
    USER ||--o{ CLIENT : owns
    CLIENT ||--o{ PROJECT : has
    PROJECT ||--o{ TASK : has
    USER ||--o{ TIME_ENTRY : records
    PROJECT ||--o{ TIME_ENTRY : has
    TASK o|--o{ TIME_ENTRY : has
```
