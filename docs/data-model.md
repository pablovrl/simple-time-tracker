```mermaid
erDiagram
    USER ||--o{ SESSION : authenticates
    USER ||--o{ TASK : owns
    USER ||--o{ TIME_ENTRY : records
    TASK ||--o{ TIME_ENTRY : has
```
