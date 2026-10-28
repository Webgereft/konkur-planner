// تنظیمات اتصال به Supabase
const SUPABASE_URL = 'https://fvkzvfumabhhqzozxwlb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2a3p2ZnVtYWJoaHF6b3p4d2xiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MDAzNzAsImV4cCI6MjEwODA3NjM3MH0.R4qUmFcN_c1U3wtYJoIPlg-BEt5yoeEl2Uo1cW62MNM';

// مقداردهی اولیه کلاینت
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
