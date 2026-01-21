# Sales Tracking App - PostgreSQL Migration

This project has been migrated from MySQL to PostgreSQL to support deployment on Render.

## Deployment on Render

1.  **Create a PostgreSQL Database on Render:**
    *   Go to your Render Dashboard.
    *   Click "New" -> "PostgreSQL".
    *   Give it a name (e.g., `sales-db`).
    *   Select the region and plan (Free tier is fine for testing).
    *   Copy the `Internal Database URL` (for internal networking if deploying app on Render) or `External Database URL` (for connecting from your local machine).

2.  **Deploy the Web Service:**
    *   Click "New" -> "Web Service".
    *   Connect your GitHub repository.
    *   **Build Command:** `npm install`
    *   **Start Command:** `npm start`
    *   **Environment Variables:**
        *   `DATABASE_URL`: Paste the Internal Database URL from the PostgreSQL service you created.
        *   `JWT_SECRET`: Set a secure secret for JWT tokens.
        *   `NODE_ENV`: `production`

## Database Initialization

You need to run the SQL schema to create the tables in your new PostgreSQL database.

1.  **Connect to your PostgreSQL database.** You can use a tool like **pgAdmin**, **DBeaver**, or the command line `psql`.
2.  **Run the Schema Script:**
    *   Open `sql/schema.postgres.sql`.
    *   Copy the content and execute it in your database query tool.
    *   This will create all necessary tables (`users`, `shops`, `products`, `stock`, `sales`, `sale_items`) and triggers.

## Local Development

To run the app locally with PostgreSQL:

1.  Install PostgreSQL locally or use a cloud instance.
2.  Create a `.env` file in the root directory:
    ```env
    DB_HOST=localhost
    DB_PORT=5432
    DB_USER=postgres
    DB_PASSWORD=your_password
    DB_NAME=sales_db
    JWT_SECRET=dev-secret
    ```
    *Or simply:*
    ```env
    DATABASE_URL=postgresql://user:password@localhost:5432/sales_db
    ```
3.  Run `npm start`.

## Key Changes from MySQL

*   **Driver:** Switched from `mysql2` to `pg`.
*   **Syntax:** Queries now use `$1, $2` placeholders instead of `?`.
*   **Auto-increment:** Uses `SERIAL` types.
*   **Date Functions:** Uses PostgreSQL specific date functions (`CURRENT_DATE`, `DATE_TRUNC`, etc.).
*   **Booleans:** Uses native `BOOLEAN` type instead of `TINYINT`.
