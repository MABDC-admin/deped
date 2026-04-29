import { motion } from 'framer-motion'
import Modal from './Modal'

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title = 'Confirm Delete', message = 'Are you sure? This action cannot be undone.', loading }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <motion.div
        initial={{ opacity: 0, x: 0 }}
        animate={{ opacity: 1, x: [0, -4, 4, -4, 4, 0] }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <p className="text-gray-600 mb-6">{message}</p>
      </motion.div>
      <div className="flex justify-end gap-3">
        <motion.button
          onClick={onClose}
          className="btn-secondary"
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Cancel
        </motion.button>
        <motion.button
          onClick={onConfirm}
          className="btn-danger"
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {loading ? 'Deleting...' : 'Delete'}
        </motion.button>
      </div>
    </Modal>
  )
}
