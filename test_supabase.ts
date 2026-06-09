import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vjmwknqdeilrvocimwsw.supabase.co'
const supabaseKey = 'sb_publishable_aJVVMTk3qgNBSlcDGpfH1w_uHyxIAX_'
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
