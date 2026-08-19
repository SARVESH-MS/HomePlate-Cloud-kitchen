# Home Plate Cloud Kitchen

Home Plate is a food-ordering application with a React frontend, a Node.js/Express backend, and MongoDB Atlas database storage.

## Run the project - beginner guide

Follow the steps in this order. You need **two PowerShell terminals**: one for the backend and one for the frontend.

### 1. Open the project folder

Open PowerShell and go to the project folder:

```powershell
cd "E:\GitHub project\HomePlate-Cloud-kitchen--main"
```

### 2. Check that Node.js is installed

Run:

```powershell
node --version
npm --version
```

Both commands must show a version number. If either command says it is not recognized, install the current **Node.js LTS** version from [nodejs.org](https://nodejs.org/), close PowerShell, open it again, and repeat this step.

### 3. Configure MongoDB Atlas

Open `backend/.env` in VS Code. It must contain these values:

```env
PORT=5000
MONGODB_URI=mongodb+srv://<atlas-username>:<atlas-password>@<atlas-cluster-host>/homeplate?retryWrites=true&w=majority
JWT_SECRET=replace-this-with-a-long-random-secret
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
CORS_ORIGINS=http://localhost:3000
# Optional after deployment, for example: https://api.example.com
PUBLIC_API_URL=
```

Replace only the text inside `<...>` in `MONGODB_URI` with your own MongoDB Atlas connection details.

Important:

- In MongoDB Atlas, open **Security → Network Access** and add your current IP address.
- In **Security → Database Access**, make sure the database user in the connection string exists and has read/write access.
- Do not share or commit `backend/.env`; it contains private credentials.
- `OPENAI_API_KEY` is optional. With a key, the chatbot uses AI together with your current MongoDB menu and order data. Without a key, it still gives basic answers from the live Home Plate menu and relevant orders.

### 4. Install backend packages

In the first PowerShell terminal, run:

```powershell
cd "E:\GitHub project\HomePlate-Cloud-kitchen--main\backend"
npm install
```

Wait for a message similar to `up to date` or `added ... packages`.

### 5. Add sample data to Atlas (optional, recommended first time)

In the same backend terminal, run:

```powershell
npm run seed
```

Expected result:

```text
Seed complete: users, sellers, dishes, orders and reviews are ready.
```

This adds sample cloud kitchens, dishes, a customer, an order, and a review to the `homeplate` database. It is safe to run again; it updates the same sample records instead of duplicating them.

### Sample login accounts created by `npm run seed`

Use these only for local testing or a demo database. Do **not** use these credentials for a real production app.

| Role | Name / kitchen | Username or email | Password |
| --- | --- | --- | --- |
| Customer | Priya | `priya@example.com` | `Homeplate@123` |
| Seller | Indhu's Kitchen | `indhu05` | `Homeplate@123` |
| Seller | Velu's Kitchen | `velu2` | `Homeplate@123` |
| Seller | Anitha's Meals | `anitha01` | `Homeplate@123` |

Customer login uses the **email**. Seller login uses the **username**. A delivery partner is not created by the seed command; open **Delivery Login** in the app and register a delivery account first.

Never add real users' passwords, MongoDB connection strings, JWT secrets, or API keys to this README or to GitHub.

### Delivery-person login

Delivery people are created from the **Delivery Login** page, not by `npm run seed`.

1. Open the app and click **Delivery Login**.
2. Choose **Register**.
3. Enter the delivery person's name, username, email, phone number, and a password.
4. Log in using the same **username** and password.

The account is stored in the `homeplate.deliverypeople` collection. The `password` field visible in MongoDB Atlas starts with `$2...`; it is encrypted and cannot be used as the login password. If a delivery person forgets their password in a demo, delete that test account and register it again with a new password.

#### Current demo delivery account

| Role | Username | Password |
| --- | --- | --- |
| Delivery person | `SARVESH__` | `123` |

This account is for demonstration only. Change its password or delete the account before making the project public.

### 6. Start the backend

Still in the backend terminal, run:

```powershell
npm start
```

Expected result:

```text
MongoDB Connected
Server running on port 5000
```

Leave this terminal running. The backend API is now available at `http://localhost:5000`.

### 7. Install and start the frontend

Open a **second** PowerShell terminal and run:

```powershell
cd "E:\GitHub project\HomePlate-Cloud-kitchen--main\frontend"
npm install
npm start
```

The browser should open automatically. If it does not, open:

```text
http://localhost:3000
```

### 8. Use the app

1. Register a new customer or seller account.
2. A new customer is saved in the MongoDB `users` collection.
3. A new seller is saved in `sellers`.
4. A seller can add dishes; they are saved in `dishes`.
5. A customer can place an order; it is saved in `orders`.
6. Reviews are saved in `reviews`.
7. Signed-in chatbot conversations are saved in `chatconversations`.

## Stop the project

In each PowerShell terminal, press:

```text
Ctrl + C
```

Type `Y` if PowerShell asks to terminate the batch job.

## Common problems

### `npm` or `node` is not recognized

Install Node.js LTS, then close and reopen PowerShell.

### `MongoDB Connection Error`

Check these items:

1. `MONGODB_URI` is correctly set in `backend/.env` (not `MONGO_URI`).
2. The Atlas database-user password is correct.
3. Your current IP address is added in Atlas Network Access.
4. Your internet connection is active.

### Frontend opens but dishes do not load

Make sure the backend terminal is still running and visit `http://localhost:5000/api/health`. It should return a small JSON response with `"status":"OK"`.

### Port 5000 or 3000 is already in use

Close any older backend/frontend terminals, or stop the existing process with `Ctrl + C`, then run the command again.

### Images do not show after deployment

During local development, images are stored in `backend/uploads`. MongoDB stores only their URLs. Before deploying, move uploaded images to cloud storage such as Cloudinary or Amazon S3.

### Deploying later

Set `REACT_APP_API_URL` in the frontend deployment environment to your backend URL plus `/api`, for example `https://api.example.com/api`. Set `CORS_ORIGINS` and `PUBLIC_API_URL` in the backend deployment environment to the matching public URLs.

## Database collections

| Collection | Stores |
| --- | --- |
| `users` | Customer accounts |
| `sellers` | Kitchen accounts and logo URLs |
| `dishes` | Menu items |
| `orders` | Customer orders and status |
| `reviews` | Customer ratings and comments |
| `chatconversations` | Private chatbot histories per signed-in user |
