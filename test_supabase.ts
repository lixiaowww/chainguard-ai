import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env before running this test.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  console.log('Testing connection to Supabase...')
  const { data, error } = await supabase.from('tms_shipments').select('*').limit(1)
  
  if (error) {
    console.error('Connection failed or table "tms_shipments" does not exist.')
    console.error('Error details:', error.message)
    process.exit(1)
  } else {
    console.log('Successfully connected to Supabase!')
    console.log('Current data count in tms_shipments:', data.length)
    process.exit(0)
  }
}

testConnection()
