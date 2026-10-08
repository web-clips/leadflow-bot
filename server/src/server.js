import 'dotenv/config'
import app from './app.js'
import './bot/bot.js'

const PORT = process.env.PORT || 5005;

app.listen(PORT, ()=>{
    console.log(`Server started on port ${PORT}`)
})