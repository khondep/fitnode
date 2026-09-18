// import { NextRequest, NextResponse } from "next/server";
// import { createClient } from "@supabase/supabase-js";
// import pdf from "pdf-parse/lib/pdf-parse.js";
// import mammoth from "mammoth";

// const supabase = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.SUPABASE_SERVICE_ROLE_KEY!
// );

// export async function POST(req: NextRequest) {
//   // 1. Get the file out of the incoming request
//   const formData = await req.formData();
//   const file = formData.get("file") as File;

//   if (!file) {
//     return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
//   }

//   // 2. Convert it to a Buffer so Node.js libraries can read it
//   const arrayBuffer = await file.arrayBuffer();
//   const buffer = Buffer.from(arrayBuffer);

//   // 3. Extract raw text depending on file type
//   let text = "";
//   try {
//     if (file.type === "application/pdf") {
//       const data = await pdf(buffer);
//       text = data.text;
//     } else if (file.name.endsWith(".docx")) {
//       const result = await mammoth.extractRawText({ buffer });
//       text = result.value;
//     } else {
//       return NextResponse.json(
//         { error: "Only PDF and DOCX files are supported" },
//         { status: 400 }
//       );
//     }
//   } catch (err) {
//     return NextResponse.json(
//       { error: "Failed to parse file" },
//       { status: 500 }
//     );
//   }

//   // 4. Upload the original file to Supabase Storage
//   const filePath = `${Date.now()}-${file.name}`;
//   const { error: uploadError } = await supabase.storage
//     .from("resumes")
//     .upload(filePath, buffer, { contentType: file.type });

//   if (uploadError) {
//     console.log("UPLOAD ERROR:", uploadError); return NextResponse.json({ error: uploadError.message }, { status: 500 });
//   }

//   // 5. Save a row in the database with the extracted text
//   const { data: resume, error: dbError } = await supabase
//     .from("resumes")
//     .insert({
//       file_path: filePath,
//       raw_text: text,
//     })
//     .select()
//     .single();

//   if (dbError) {
//     console.log("DB ERROR:", dbError); return NextResponse.json({ error: dbError.message }, { status: 500 });
//   }

//   // 6. Send the result back to the frontend
//   return NextResponse.json({ success: true, resume });
// }

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";
import pdf from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let text = "";
  try {
    if (file.type === "application/pdf") {
      const data = await pdf(buffer);
      text = data.text;
    } else if (file.name.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      return NextResponse.json(
        { error: "Only PDF and DOCX files are supported" },
        { status: 400 }
      );
    }
  } catch (err) {
    return NextResponse.json({ error: "Failed to parse file" }, { status: 500 });
  }

  const filePath = `${user.id}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(filePath, buffer, { contentType: file.type });

  if (uploadError) {
    console.log("UPLOAD ERROR:", uploadError); return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: resume, error: dbError } = await supabase
    .from("resumes")
    .insert({ file_path: filePath, raw_text: text, user_id: user.id })
    .select()
    .single();

  if (dbError) {
    console.log("DB ERROR:", dbError); return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, resume });
}