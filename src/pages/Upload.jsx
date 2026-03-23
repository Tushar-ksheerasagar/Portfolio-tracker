import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { UploadCloud, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { uploadPortfolio } from '../services/api'

const Upload = ({ setPortfolioData }) => {
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState({ message: '', type: '' })
  const navigate = useNavigate()

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      setStatus({ message: 'Please upload a CSV file', type: 'error' })
      return
    }

    setUploading(true)
    setStatus({ message: 'Uploading...', type: 'info' })

    try {
      const data = await uploadPortfolio(file)
      
      setPortfolioData(data)
      setStatus({ message: 'File uploaded successfully!', type: 'success' })
      
      setTimeout(() => {
        navigate('/dashboard')
      }, 1500)
    } catch (error) {
      console.error('Upload error:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Upload failed. Please try again.'
      setStatus({
        message: errorMessage,
        type: 'error',
      })
    } finally {
      setUploading(false)
    }
  }, [navigate, setPortfolioData])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
  })

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-accent-indigo to-accent-purple bg-clip-text text-transparent">
          Upload Portfolio
        </h1>
        <p className="text-gray-400 mb-8">Import your investment data to get started</p>

        {/* Upload Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300 ${
              isDragActive
                ? 'border-accent-indigo bg-accent-indigo/10'
                : 'border-dark-border hover:border-accent-indigo/50'
            }`}
          >
            <input {...getInputProps()} />
            
            <motion.div
              animate={{
                scale: isDragActive ? 1.1 : 1,
                rotate: isDragActive ? 5 : 0,
              }}
              transition={{ duration: 0.3 }}
            >
              <UploadCloud className="w-24 h-24 mx-auto mb-6 text-accent-indigo" />
            </motion.div>

            <h2 className="text-2xl font-semibold mb-2">
              {isDragActive ? 'Drop your file here' : 'Upload Portfolio Data'}
            </h2>
            <p className="text-gray-400 mb-6">
              Drag and drop your CSV file or click to browse
            </p>

            {uploading && (
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="spinner"></div>
                <span className="text-gray-400">Processing...</span>
              </div>
            )}

            {status.message && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center justify-center gap-2 p-4 rounded-lg ${
                  status.type === 'success'
                    ? 'bg-green-500/10 text-green-400'
                    : status.type === 'error'
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-blue-500/10 text-blue-400'
                }`}
              >
                {status.type === 'success' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : status.type === 'error' ? (
                  <AlertCircle className="w-5 h-5" />
                ) : null}
                <span>{status.message}</span>
              </motion.div>
            )}
          </div>

          {/* Requirements */}
          <div className="mt-8 p-6 bg-dark-bg rounded-lg">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent-indigo" />
              File Requirements
            </h3>
            <ul className="space-y-2 text-gray-400">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span>CSV format with columns: company_name (or symbol), quantity, buy_price</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span>Company names must match database entries</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span>Quantity must be a positive integer and buy_price must be a positive number</span>
              </li>
            </ul>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default Upload
