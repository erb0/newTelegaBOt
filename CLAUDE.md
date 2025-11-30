# CLAUDE.md - Telegram Water Utility Bot

## Project Overview

This is a Telegram bot for managing water utility services (ЖКХ - Жилищно-коммунальное хозяйство) in Sayram, Kazakhstan. The bot allows authorized inspectors and administrators to:

- Search for consumer information by account number, meter number, or name
- Insert water meter readings
- Generate reports on unpaid accounts
- View and upload photos of water meters
- Export logs to Excel
- Process Kaspi payment reports

**Primary Language**: Russian (all user-facing text and database content)
**Tech Stack**: Node.js, Telegraf (Telegram bot framework), MongoDB, MS Access Database
**Process Manager**: PM2 for production deployment

## Architecture Overview

```
newTelegaBOt/
├── index.js              # Application entry point, initializes DB and bot
├── bot.js                # Main bot configuration, handlers, and routing
├── package.json          # Dependencies and npm scripts
├── .env                  # Environment variables (NEVER commit)
├── modules/              # Core functionality modules
│   ├── accessDb.js       # MS Access database connection and code mappings
│   ├── auth.js           # User authentication and authorization
│   ├── button.js         # Telegram inline keyboard layouts
│   ├── mongoDb.js        # MongoDB schemas and connection
│   ├── plugin.js         # Utility functions (logging, Excel export)
│   ├── sqlInfo.js        # Database query functions for consumer info
│   ├── sqlInsert.js      # Water meter reading insertion logic
│   ├── reports/          # Report generation modules
│   │   ├── didntPay.js   # Non-payment report
│   │   ├── reportKaspi.js # Kaspi payment processing
│   │   └── wmNotTaken.js  # Meter reading status report
│   ├── fonts/            # Font files for PDF generation
│   └── log/              # Log files
└── sample/               # Legacy/backup code (DO NOT modify)
```

## Key Components

### 1. Entry Point (`index.js`)

**Purpose**: Initialize the application in the correct order
**Flow**:
1. Call `main()` from `accessDb.js` to populate code mappings from Access DB
2. Start the Telegraf bot via `botStart()`
3. Launch the bot with `bot.launch()`

**Important**: The Access DB must be initialized BEFORE the bot starts, or code lookups will fail.

### 2. Bot Core (`bot.js`)

**Purpose**: Main bot logic, command handlers, and message routing
**Key Features**:
- State-based message handling using MongoDB user states
- Authentication middleware (`ensureAuth`)
- Command handlers: `/start`, `/info`, `/insert`, `/list`, `/didntpay`, `/kaspi`, `/mongo`, `/photos`
- Text message routing based on user state
- Photo upload handling with Supabase storage
- Callback query handlers for inline buttons

**State Machine**:
Users have a `state` field in MongoDB that determines how their messages are processed:
- `start`: Initial state
- `searchbyuser`: Waiting for account number
- `searchwm`: Waiting for water meter number
- `searchbyname`: Waiting for consumer name
- `insertConscode`: Waiting for account number to insert reading
- `insertValue`: Waiting for meter reading value
- `waiting_photo`: Expecting photo upload
- `list`: Waiting for controller code or name
- `didntPay`: Waiting for controller code for non-payment report

### 3. Database Integration

#### Access Database (`accessDb.js`)
**Purpose**: Connect to legacy MS Access database containing consumer data
**Technology**: `node-adodb` library with JET.OLEDB.4.0 provider
**Connection**: Network share `//SERVERBD/sayram/Сайрам.mdb`
**Code Mappings**: Populates in-memory objects on startup:
- `deskCodes`: Payment desk codes
- `paymentCodes`: Payment group codes
- `streetCodes`: Street codes
- `locationCodes`: Section/controller codes with names

**CRITICAL**: These code mappings are loaded once at startup with 5-second delays between queries to avoid overwhelming the Access DB. Changes to codes require bot restart.

#### MongoDB (`mongoDb.js`)
**Purpose**: Modern database for user state, logs, and photos
**Connection**: Uses `MONGODB_URI` from `.env`
**Schemas**:
- `User`: Telegram user data, state, privileges, data object
- `Consumer`: Consumer data (appears unused, may be legacy)
- `Log`: Activity logs (chatId, name, type, data, timestamp)
- `Photo`: Water meter photos (chatId, name, CONSCODE, photoUrl, date)

### 4. Authentication System (`auth.js`)

**Two-Level System**:

1. **Basic Auth (`auth` object)**: Simple user ID → name mapping for basic recognition
2. **Full Auth (`authChatId` object)**: User ID → `{name, section[]}` with section access control

**Section Codes**: Array of 4-digit codes (e.g., `[2314, 2316, 2305, ...]`) representing geographic areas/controllers the user can access. Admins have access to all sections.

**Authorization Pattern**:
```javascript
if (!authChatId[userId]) return ctx.reply("Вы не авторизованы!");
```

**IMPORTANT**: Authorization is hardcoded in `auth.js`. To add/modify users:
1. Get their Telegram user ID (visible in bot logs)
2. Add entry to both `auth` and `authChatId` objects
3. Restart bot

### 5. Query Modules

#### `sqlInfo.js` - Consumer Information Queries
**Functions**:
- `searchByUser(locationCodeArray, searchValue, ctx, User)`: Search by account number (л/с)
- `searchByWm(text, ctx)`: Search by water meter number (в/м)
- `searchByName(text, ctx)`: Search by consumer name (фио)
- `searchPayment(User, ctx)`: Show payment information
- `searchCheap(User, ctx)`: Show meter reading entry form
- `handlePhotoUpload(ctx, conscode, supabase, Photo)`: Upload meter photo to Supabase

**Pattern**: All search functions:
1. Validate input
2. Log the query to both file and MongoDB
3. Execute SQL query against Access DB
4. Format results with emojis and Russian labels
5. Send to user with inline keyboards
6. Update user state in MongoDB

#### `sqlInsert.js` - Meter Reading Insertion
**Functions**:
- `userInfoForInsert(userId, text, ctx, User)`: Get consumer info and meters
- `wcodeInfoForInsert(ctx, User)`: Handle meter selection
- `insertValue(userId, text, ctx, User)`: Insert meter reading
- `insertIfYes(ctx, User)`: Confirm and execute insertion

**Flow**:
1. User enters account number → query meters
2. Display inline keyboard with meter numbers
3. User selects meter → request current reading
4. User enters reading → validate and show confirmation
5. User confirms → insert into `WCHEAP` table in Access DB

**CRITICAL DATE HANDLING**: Line 17 in `sqlInsert.js` has hardcoded date:
```javascript
VALUES (${WCODE}, #05/31/2025#, ${LASTCOUNT}, ${CURRCOUNT}, null)
```
This should likely use current date. Verify business logic before changing.

## Environment Variables

Required in `.env` file:

```bash
# Telegram Bot
TELEGRAM_TOKEN=<bot_token_from_@BotFather>

# MongoDB
MONGODB_URI=mongodb://localhost:27017/waterbot

# Supabase (for photo storage)
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_KEY=<anon_key>
BUCKET_NAME=<bucket_name>
```

**SECURITY**: Never commit `.env` file. It's in `.gitignore`.

## Development Workflow

### Starting Development

```bash
# Install dependencies
npm install

# Run in development mode (auto-restart on changes)
npm run dev

# Run in production mode
npm start
```

### Production Deployment with PM2

```bash
# Start bot with PM2
npm run pm2-start

# View logs
npm run pm2-logs

# Restart after code changes
npm run pm2-restart

# Stop bot
npm run pm2-stop

# Remove from PM2
npm run pm2-delete

# Save PM2 configuration
npm run pm2-save
```

### Testing Changes

**CRITICAL**: This bot interacts with a production Access database. Test carefully:

1. **For query changes**: Test with known valid account numbers first
2. **For insert operations**: Verify SQL syntax in test environment or use console.log before executing
3. **For auth changes**: Test with your own Telegram account before deploying
4. **For state changes**: Clear test user states in MongoDB between tests

**No Test Suite**: This project has no automated tests. Manual testing via Telegram is required.

## Code Conventions

### 1. Error Handling

**Pattern**: Try-catch with user-friendly messages
```javascript
try {
  // operation
} catch (error) {
  console.error("Detailed error:", error);
  ctx.reply("Произошла ошибка. Попробуйте позже.");
}
```

**Special Case - 403 Errors**: Users who block the bot cause 403 errors. Use `safeReply()` in `bot.js`:
```javascript
async function safeReply(ctx, ...args) {
  try {
    await ctx.replyWithHTML(...args);
  } catch (error) {
    if (error.response?.error_code === 403) {
      console.log(`User ${ctx.from.id} blocked the bot.`);
    } else {
      console.error(`Failed to send message:`, error);
    }
  }
}
```

### 2. Database Query Pattern

**Access DB Queries**:
```javascript
await checkConnection(); // Always check connection first
const query = `SELECT ... FROM ... WHERE ...`;
const data = await connection.query(query); // For SELECT
await connection.execute(query); // For INSERT/UPDATE/DELETE
```

**MongoDB Operations**:
```javascript
const user = await User.findOne({ user_id: userId });
await User.updateOne({ user_id: userId }, { state: "newState" });
await user.save();
```

### 3. Logging Pattern

**Dual Logging**: Log to both file and MongoDB
```javascript
const { logInfo } = require("./plugin");
const { logInfoMongo } = require("./mongoDb");

logInfo(chatId, name, searchValue, "Лсчет", ctx);
logInfoMongo(chatId, name, searchValue, "Лсчет", ctx);
```

### 4. Button Creation

Use predefined button layouts from `modules/button.js`:
```javascript
const { search, clear, menu } = require("./modules/button");

await ctx.reply("Choose option", search); // Inline keyboard
```

### 5. User Data Storage

**Pattern**: Store temporary data in user.data object
```javascript
user.data = {
  ...user.data,
  searchValue,
  consname: data[0].consname,
  sentMessage: sentMessage.message_id,
};
await user.save();
```

### 6. Russian Language

**All user-facing text is in Russian**:
- Use Russian for messages, buttons, logs
- Database contains Cyrillic data
- Comments can be in English or Russian
- Variable names are in English

## Common Tasks

### Adding a New Command

1. **Add command handler in `bot.js`**:
```javascript
bot.command("mycommand", ensureAuth, async (ctx) => {
  await safeReply(ctx, "Введите данные...");
  await User.updateOne({ user_id: ctx.from.id }, { state: "mycommand" });
});
```

2. **Add state handler**:
```javascript
const stateHandlers = {
  // existing handlers...
  mycommand: async (text, ctx, user) => {
    // process text input
  }
};
```

3. **Create processing function in appropriate module** (`sqlInfo.js`, `sqlInsert.js`, or new module)

4. **Test with authorized Telegram account**

### Adding a New User

1. **Get Telegram user ID**: Start bot with user, check logs for user ID
2. **Edit `modules/auth.js`**:
```javascript
const authChatId = {
  // existing users...
  123456789: {
    name: "New User Name",
    section: [2301, 2358, 2379], // or all sections for admin
  },
};
```
3. **Restart bot**: `npm run pm2-restart`

### Modifying Database Queries

**Access DB**:
- Table names: `CONSUM`, `WCOUNT`, `WCHEAP`, `SECTION`, `STREET`, `PAYDESK`, `GROUP`
- Use square brackets for reserved words: `[GROUP]`, `[FSBDVCODE]`
- Date format: `#MM/DD/YYYY#` (American format, not Russian!)
- String literals: Use single quotes `'value'`

**Common Joins**:
```sql
-- Consumer with payment info
FROM CONSUM
INNER JOIN зTOTPAY_ALL_Тек ON CONSUM.CONSCODE = зTOTPAY_ALL_Тек.CONSCODE

-- Consumer with meter info
FROM CONSUM
INNER JOIN WCOUNT ON CONSUM.CONSCODE = WCOUNT.CONSCODE
```

### Debugging

1. **Check logs**: `npm run pm2-logs` or console output in dev mode
2. **Check MongoDB**: Query User collection for state issues
3. **Check Access DB connection**: Look for ADODB errors in logs
4. **Test queries**: Use `connection.query()` with console.log before sending to user
5. **Telegram errors**: 403 = blocked bot, 400 = invalid request, 429 = rate limited

## Known Issues & Quirks

### 1. Access Database Connection
- **Issue**: Connection can timeout or hang
- **Solution**: 5-second delays between startup queries, `checkConnection()` before queries
- **Location**: `modules/accessDb.js:99-123`

### 2. Hardcoded Date in Insert
- **Issue**: `sqlInsert.js:17` has hardcoded date `#05/31/2025#`
- **Impact**: All meter readings inserted with this date instead of current date
- **Location**: `modules/sqlInsert.js:17`

### 3. Admin-Only Commands
- **Commands**: `/kaspi`, `/mongo` are hardcoded to user ID `498318670`
- **Location**: `bot.js:147, 153`
- **Pattern**:
```javascript
if (ctx.chat.id !== 498318670) return await safeReply(ctx, "У вас нет доступа");
```

### 4. Sample Directory
- **Purpose**: Contains old/backup code
- **Rule**: DO NOT modify or use code from `sample/` directory
- **Reason**: May be outdated or incompatible with current structure

### 5. Handler Timeout
- **Setting**: `handlerTimeout: 300000` (5 minutes) in bot initialization
- **Reason**: Some operations (reports, Excel export) can take a long time
- **Location**: `bot.js:40-42`

## Security Considerations

### 1. Authentication
- **Current**: Hardcoded user IDs in `auth.js`
- **Limitation**: Requires code change and restart to add users
- **Risk**: No dynamic user management

### 2. Authorization
- **Pattern**: Check `authChatId[userId]` before operations
- **Section Access**: Users only query data from their assigned sections
- **SQL Injection**: Parameterized queries NOT used - input validation is critical

### 3. Credentials
- **Access DB**: Credentials in `accessDb.js` (should move to .env)
- **Telegram Token**: In `.env` (correct)
- **MongoDB**: Connection string in `.env` (correct)

### 4. Input Validation
- **Number validation**: `isPositiveNumber()`, `validateNumberInput()`
- **SQL**: NO prepared statements - relies on validation before query construction
- **Risk**: Potential SQL injection if validation bypassed

**RECOMMENDATION**: When modifying queries, always validate and sanitize user input.

## Performance Considerations

### 1. Code Loading
- **When**: Startup only
- **Duration**: ~20 seconds (4 queries × 5 second delay)
- **Impact**: Bot unavailable during initialization

### 2. Access DB Queries
- **Speed**: Can be slow (network share + old DB technology)
- **Pattern**: Single query per user request
- **Timeout**: 5-minute handler timeout to accommodate slow queries

### 3. Message Deletion
- **Pattern**: Delete previous search result before sending new one
- **Reason**: Keep chat clean
- **Location**: `sqlInfo.js:61-72`

### 4. Photo Storage
- **Method**: Upload to Supabase, store URL in MongoDB
- **Reason**: Telegram file storage not reliable, Supabase provides CDN
- **Location**: Photo handling in `sqlInfo.js`

## Report Generation

### 1. Non-Payment Report (`didntPay.js`)
- **Trigger**: `/didntpay` command → enter controller code
- **Query**: Consumers with debt by section
- **Output**: Formatted text message (may be split if >4000 chars)

### 2. Kaspi Report (`reportKaspi.js`)
- **Trigger**: `/kaspi` command (admin only)
- **Purpose**: Process Kaspi payment system reports
- **Output**: Excel file or processed data

### 3. Log Export (`plugin.js`)
- **Trigger**: `/mongo` command (admin only)
- **Purpose**: Export MongoDB logs to Excel
- **Output**: Excel file sent to chat

## Dependencies

### Core Dependencies
- `telegraf@^4.16.3`: Modern Telegram bot framework (prefer over node-telegram-bot-api)
- `node-adodb@^5.0.3`: MS Access database connection
- `mongoose@^8.3.2`: MongoDB ODM
- `@supabase/supabase-js@^2.49.8`: Photo storage

### Utility Dependencies
- `dotenv@^16.4.5`: Environment variables
- `axios@^1.9.0`: HTTP requests
- `xlsx@^0.18.5`: Excel file generation
- `pdf-lib@^1.17.1`: PDF generation (may be unused)
- `node-cron@^3.0.3`: Scheduled tasks (may be unused)
- `nodemailer@^6.9.13`: Email (may be unused)

### Development Dependencies
- `nodemon@^3.1.0`: Auto-restart in development

## Git Workflow

### Current Branch
- Working on: `claude/claude-md-mil7oo0utesx9eh5-01XkHK3S9jQJ6mtPGCRU29Qu`
- Main branch: Not specified in context
- **IMPORTANT**: All commits and pushes should go to the claude/* branch

### Recent Changes
- `c346fb5`: Add user auth
- `3ac7d1c`: Fix crash + PM2
- `072ee60`: Add user auth
- `1124ddf`: Fix Supabase sendPhotoWm
- `9d85a85`: Add Supabase
- `2bc28f5`: Remove Firebase

### Commit Message Style
- Imperative mood, lowercase
- Brief descriptions
- Examples: "add user auth", "fix crash + pm2", "add supabase"

## AI Assistant Guidelines

### When Making Changes

1. **Always read before modifying**: Use Read tool on files before suggesting changes
2. **Understand state flow**: Changes to states must update both bot.js and handlers
3. **Test queries carefully**: Access DB errors can crash the bot
4. **Preserve Russian text**: Don't translate user-facing messages to English
5. **Check authorization**: Verify user has access before executing operations
6. **Log operations**: Add logging for new features using existing pattern
7. **Update user state**: Always update MongoDB state when changing user flow
8. **Handle errors gracefully**: Use try-catch and user-friendly Russian error messages

### When Adding Features

1. **Follow existing patterns**: Use state-based routing, dual logging, error handling
2. **Add to appropriate module**: sqlInfo for queries, sqlInsert for insertions, reports for reports
3. **Update auth if needed**: Document any new authorization requirements
4. **Consider Access DB limits**: Keep queries simple, avoid complex joins
5. **Test with real data**: Use development mode with actual Telegram client
6. **Document in comments**: Explain business logic, especially around dates and calculations

### When Debugging

1. **Check logs first**: PM2 logs show errors and user interactions
2. **Verify MongoDB state**: User state might be stuck in wrong value
3. **Test Access DB connection**: Connection issues are common
4. **Validate user input**: Most errors come from unexpected input
5. **Check user authorization**: Verify user in authChatId with correct sections

### When Reviewing Code

1. **Security**: Input validation, SQL injection risks, credential exposure
2. **Error handling**: Try-catch blocks, user-friendly messages
3. **State management**: Proper state transitions, cleanup
4. **Logging**: All user operations logged
5. **Performance**: Minimize Access DB queries, efficient MongoDB usage
6. **Compatibility**: Russian language, date formats, Access DB quirks

## Quick Reference

### User States
- `start`, `searchbyuser`, `searchwm`, `searchbyname`, `insertConscode`, `insertValue`, `waiting_photo`, `list`, `didntPay`

### Key Commands
- `/start`: Initialize bot
- `/info`: Search consumers
- `/insert`: Insert meter reading
- `/list`: List controllers
- `/didntpay`: Non-payment report
- `/photos <CONSCODE>`: View meter photos
- `/kaspi`, `/mongo`: Admin reports

### Key Files
- `bot.js`: Main logic
- `modules/auth.js`: User authorization
- `modules/accessDb.js`: Code mappings
- `modules/sqlInfo.js`: Consumer queries
- `modules/sqlInsert.js`: Meter reading insertion

### Database Tables (Access)
- `CONSUM`: Consumers
- `WCOUNT`: Water meters
- `WCHEAP`: Meter readings
- `SECTION`: Sections/controllers
- `STREET`: Streets
- `зTOTPAY_ALL_Тек`: Payment summary

### MongoDB Collections
- `users`: User state and data
- `logs`: Activity logs
- `photos`: Meter photos

---

**Last Updated**: 2025-11-30
**Version**: Based on commit `c346fb5`
