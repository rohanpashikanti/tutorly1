import React, { useState } from 'react';
import {
  FileText,
  Upload,
  Search,
  Filter,
  Download,
  Trash2,
  Folder,
  File,
  CheckCircle2,
  Calendar,
  Eye,
  Plus,
  X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { downloadCSV, downloadSampleDocument } from '../../utils/demoActions';

interface DocumentItem {
  id: string;
  title: string;
  category: 'Syllabus' | 'Exam Papers' | 'Fee Receipts' | 'Study Material' | 'Administrative';
  fileSize: string;
  uploadDate: string;
  uploadedBy: string;
  downloads: number;
}

const INITIAL_DOCS: DocumentItem[] = [
  {
    id: 'doc-1',
    title: 'Class 10 CBSE Mathematics Syllabus 2026-27.pdf',
    category: 'Syllabus',
    fileSize: '2.4 MB',
    uploadDate: '10 Jun 2026',
    uploadedBy: 'Priya Sharma',
    downloads: 84
  },
  {
    id: 'doc-2',
    title: 'Tuition Center Rules & Code of Conduct.pdf',
    category: 'Administrative',
    fileSize: '850 KB',
    uploadDate: '01 Apr 2026',
    uploadedBy: 'Rohan Pashikanti',
    downloads: 142
  },
  {
    id: 'doc-3',
    title: 'Class 9 Physics Formula Cheat Sheet.pdf',
    category: 'Study Material',
    fileSize: '1.2 MB',
    uploadDate: '15 Aug 2026',
    uploadedBy: 'Vikram Reddy',
    downloads: 98
  },
  {
    id: 'doc-4',
    title: 'Half Yearly Examination Timetable 2026.pdf',
    category: 'Exam Papers',
    fileSize: '450 KB',
    uploadDate: '01 Sep 2026',
    uploadedBy: 'Rohan Pashikanti',
    downloads: 210
  },
  {
    id: 'doc-5',
    title: 'Standard Fee Structure & Policy 2026-27.pdf',
    category: 'Fee Receipts',
    fileSize: '620 KB',
    uploadDate: '01 Apr 2026',
    uploadedBy: 'Rohan Pashikanti',
    downloads: 165
  }
];

export const DocumentsPage: React.FC = () => {
  const { showToast } = useApp();
  const [docs, setDocs] = useState<DocumentItem[]>(INITIAL_DOCS);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);

  // New Doc Form
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<DocumentItem['category']>('Study Material');
  const [newFileSize, setNewFileSize] = useState<string>('1.5 MB');

  const filteredDocs = docs.filter((d) => {
    const matchesCat = selectedCategory === 'All' || d.category === selectedCategory;
    const matchesSearch = d.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleDownload = (doc: DocumentItem) => {
    downloadSampleDocument(
      doc.title,
      `TUTORLY INSTITUTIONAL DOCUMENT\n\nTitle: ${doc.title}\nCategory: ${doc.category}\nUploaded By: ${doc.uploadedBy}\nUpload Date: ${doc.uploadDate}\nFile Size: ${doc.fileSize}\n\n[Local Demo Document Content]\nThis file was generated and downloaded locally via Tutorly Tuition Management Platform.`
    );
    setDocs((prev) =>
      prev.map((d) => (d.id === doc.id ? { ...d, downloads: d.downloads + 1 } : d))
    );
    showToast(`Downloaded ${doc.title}`, 'success');
  };

  const handleDelete = (id: string, title: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    showToast(`Removed "${title}" from study materials`, 'info');
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      showToast('Please enter a document title', 'warning');
      return;
    }
    const filename = newTitle.endsWith('.pdf') ? newTitle : `${newTitle}.pdf`;
    const newDoc: DocumentItem = {
      id: `doc-${Date.now()}`,
      title: filename,
      category: newCategory,
      fileSize: newFileSize,
      uploadDate: 'Today',
      uploadedBy: 'Rohan Pashikanti',
      downloads: 0
    };
    setDocs([newDoc, ...docs]);
    setShowUploadModal(false);
    setNewTitle('');
    showToast(`"${filename}" uploaded successfully to repository!`, 'success');
  };

  const handleExportIndex = () => {
    const exportData = filteredDocs.map((d) => ({
      Title: d.title,
      Category: d.category,
      Size: d.fileSize,
      'Upload Date': d.uploadDate,
      'Uploaded By': d.uploadedBy,
      Downloads: d.downloads
    }));
    downloadCSV('tutorly_documents_index.csv', exportData);
    showToast(`Exported ${exportData.length} document records to CSV`, 'success');
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-title">
          <div className="breadcrumb">
            <span>General Administration</span>
            <span>/</span>
            <span style={{ color: '#0F172A', fontWeight: 600 }}>Documents & Attachments</span>
          </div>
          <h1>Documents & Study Materials</h1>
          <p className="page-subtitle">
            Upload and manage institutional documents, curriculum guidelines, syllabi, and test archives.
          </p>
        </div>

        <div className="page-header-actions" style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            onClick={handleExportIndex}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={15} />
            <span>Export Index</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowUploadModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Upload size={16} />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div className="tabs-container" style={{ margin: 0 }}>
            {['All', 'Syllabus', 'Study Material', 'Exam Papers', 'Administrative', 'Fee Receipts'].map((cat) => (
              <button
                key={cat}
                className={`tab-btn ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="search-box" style={{ width: '280px' }}>
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search documents by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Document Grid / Table */}
      <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Document Name</th>
                <th>Category</th>
                <th>File Size</th>
                <th>Upload Date</th>
                <th>Uploaded By</th>
                <th>Downloads</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
                    No documents found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ padding: '8px', borderRadius: '6px', backgroundColor: '#EEF2FF', color: '#6366F1' }}>
                          <FileText size={16} />
                        </div>
                        <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px' }}>
                          {doc.title}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-purple">{doc.category}</span>
                    </td>
                    <td style={{ fontSize: '12.5px', color: '#64748B' }}>{doc.fileSize}</td>
                    <td style={{ fontSize: '12.5px', color: '#64748B' }}>{doc.uploadDate}</td>
                    <td style={{ fontSize: '12.5px', color: '#334155' }}>{doc.uploadedBy}</td>
                    <td style={{ fontSize: '12.5px', fontWeight: 600, color: '#10B981' }}>{doc.downloads} times</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => handleDownload(doc)}
                          title="Download document file"
                        >
                          <Download size={13} />
                          <span>Download</span>
                        </button>
                        <button
                          className="btn-icon"
                          style={{ color: '#EF4444', padding: '4px 6px' }}
                          onClick={() => handleDelete(doc.id, doc.title)}
                          title="Delete document"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={18} color="#6366F1" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Upload Institutional Document</h3>
              </div>
              <button className="btn-icon" onClick={() => setShowUploadModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUploadSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Document Title *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Class 10 Chemistry Revision Guide 2026"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="grid-2-col" style={{ gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                      Category *
                    </label>
                    <select
                      className="form-control"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                    >
                      <option value="Study Material">Study Material</option>
                      <option value="Syllabus">Syllabus</option>
                      <option value="Exam Papers">Exam Papers</option>
                      <option value="Administrative">Administrative</option>
                      <option value="Fee Receipts">Fee Receipts</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                      Estimated Size
                    </label>
                    <select
                      className="form-control"
                      value={newFileSize}
                      onChange={(e) => setNewFileSize(e.target.value)}
                    >
                      <option value="750 KB">750 KB</option>
                      <option value="1.5 MB">1.5 MB</option>
                      <option value="3.2 MB">3.2 MB</option>
                      <option value="5.8 MB">5.8 MB</option>
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    border: '2px dashed #CBD5E1',
                    borderRadius: '8px',
                    padding: '24px',
                    textAlign: 'center',
                    backgroundColor: '#F8FAFC',
                    cursor: 'pointer'
                  }}
                  onClick={() => showToast('Local demo file picked: simulated attachment ready', 'info')}
                >
                  <Upload size={24} color="#6366F1" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                    Click or drag file here to simulate upload
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                    PDF, DOCX, XLSX, or PPT up to 25MB
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowUploadModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Upload Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
