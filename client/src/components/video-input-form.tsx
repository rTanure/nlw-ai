import { FileVideo, Upload } from "lucide-react";
import { Separator } from "./ui/separator";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { getFFmpeg } from "@/lib/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { api } from "@/lib/axios";

type Status = 'waiting' | 'converting' | 'uploading' | 'generating' | 'success'

const statusMessages = {
  converting: "Convertendo...",
  generating: "Transcrevendo...",
  uploading: "Carregando...",
  success: "Sucesso!"
}

interface VideoInputFormProps {
  onVideoUploaded: (id: string) => void
}

export function VideoInputForm(props: VideoInputFormProps) {
  const [ videoFile, setVideoFile ] = useState<File | null>(null)
  const [ status, setStatus ] = useState<Status>('waiting')

  const promptInputRef = useRef<HTMLTextAreaElement>(null)

  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const { files } = event.currentTarget

    if (!files) return

    const selectedFile = files[0]

    setVideoFile(selectedFile)
  }

  async function convertVideoToAudio(video: File) {
    console.log("Convert start...")

    // Captura a instancia do ffmpeg
    const ffmpeg = await getFFmpeg()

    // Passa o binário do arquivo para dentro do ffmpeg
    await ffmpeg.writeFile('input.mp4', await fetchFile(video))

    // Loga possíveis erros do ffmpeg
    // ffmpeg.on('log', log => console.log(log))

    // Loga o progresso da conversão do arquivo
    ffmpeg.on("progress", (progress) => {
      console.log("Convert progress: " + Math.round(progress.progress * 100))
    })

    await ffmpeg.exec([
      '-i',
      'input.mp4',
      '-map',
      '0:a:0?',
      '-b:a',
      '20k',
      '-acodec',
      'libmp3lame',
      'output.mp3'
    ])

    const data = await ffmpeg.readFile('output.mp3')

    const audioFileBlob = new Blob([data], {type: 'audio/mpeg'})
    const audioFile = new File([audioFileBlob], 'audio.mp3', {
      type: 'audio/mpeg'
    })

    console.log("Convert finished...")

    return audioFile
  }

  async function handleUploadVideo(event: FormEvent<HTMLFormElement>){
    event.preventDefault()

    const prompt = promptInputRef.current?.value

    if(!videoFile) return

    // converter video em audio
    setStatus("converting")

    const audioFile = await convertVideoToAudio(videoFile)

    const data = new FormData()

    data.append('file', audioFile)

    const response = await api.post("/videos", data)
    setStatus("uploading")

    const videoId = response.data.id
    setStatus("generating")

    await api.post(`/videos/${videoId}/transcription`, {
      prompt
    })

    setStatus("success")

    props.onVideoUploaded(videoId)
  }

  // Previne que uma variável seja recarregada apenas se um atributo especifico mudar.
  const previewURL = useMemo(() => {
    if(!videoFile) return null

    return URL.createObjectURL(videoFile)
  }, [videoFile])

  return (
    <form className="space-y-6 px-1" onSubmit={handleUploadVideo}>
      <label 
        htmlFor="video"
        className="overflow-hidden relative border flex rounded-md aspect-video cursor-pointer border-dashed text-sm flex-col gap-2 items-center justify-center text-muted-foreground hover:bg-white/5"
      >
        {previewURL ? (
          <video src={previewURL} controls={false} className="absolute inset-0 pointer-events-none"/>
        ) : (
          <>
            <FileVideo />
            Selecione um vídeo
          </>
        )}
      </label>
      <input type="file" id="video" accept="video/mp4" className="sr-only" onChange={handleFileSelected}/>
      <Separator />

      <div className="space-y-2 px-1">
        <Label htmlFor="transcription_prompt">Prompt de transcrição</Label>
        <Textarea
          disabled={status != 'waiting'}
          ref={promptInputRef} 
          id="transcription_prompt" 
          className="h-20 leading-relaxed resize-none" 
          placeholder="Inclua palavras chaves mencionadas no video separadas por virgula."
        />
      </div>

      <Button 
        data-success={status === 'success'}
        disabled={status != 'waiting'} 
        type="submit" 
        className="w-full data-[success=true]:bg-emerald-400 data-[success=true]:text-slate-50"
      >
        {status === "waiting" ? (
          <>
            Carregar video
            <Upload className="w-4 h-4 ml-2"/>    
          </>
        ) : statusMessages[status]}
      </Button>
      <Separator className=""/>
    </form>
  )
}