import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1]
  if (!token) return res.status(401).json({ error: "No token" })

  const decoded = jwt.decode(token)
  req.user = decoded
  next()
}

/* -------- AUTH -------- */

app.post('/signup', async (req, res) => {
  const { email, password, username } = req.body

  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) return res.status(400).json(error)

  await supabase.from('profiles').insert({
    id: data.user.id,
    username
  })

  res.json({ success: true })
})

app.post('/login', async (req, res) => {
  const { email, password } = req.body

  const { data, error } = await supabase.auth.signInWithPassword({
    email, password
  })

  if (error) return res.status(401).json(error)

  res.json({
    token: data.session.access_token,
    user: data.user
  })
})

/* -------- SEARCH USER -------- */

app.get('/user/:query', verifyToken, async (req, res) => {
  const q = req.params.query

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .or(`id.eq.${q},username.eq.${q}`)
    .single()

  res.json(data || null)
})

/* -------- CHAT -------- */

app.post('/chat/start', verifyToken, async (req, res) => {
  const { userId } = req.body

  const { data } = await supabase.from('chats')
    .insert({
      user1: req.user.sub,
      user2: userId
    })
    .select()
    .single()

  res.json(data)
})

app.get('/chat/my', verifyToken, async (req, res) => {
  const id = req.user.sub

  const { data } = await supabase
    .from('chats')
    .select('*')
    .or(`user1.eq.${id},user2.eq.${id}`)

  res.json(data)
})

app.get('/chat/messages/:id', verifyToken, async (req, res) => {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', req.params.id)
    .order('created_at')

  res.json(data)
})

app.post('/chat/send', verifyToken, async (req, res) => {
  const { chatId, content } = req.body

  const { data } = await supabase.from('messages').insert({
    chat_id: chatId,
    sender: req.user.sub,
    content
  })

  res.json(data)
})

app.listen(process.env.PORT, () => {
  console.log("Server running on port", process.env.PORT)
})
