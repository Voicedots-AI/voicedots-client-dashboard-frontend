/**
 * Utility to generate and trigger browser download of a sample CSV template
 * for bulk email imports.
 */

export function downloadSampleCsv() {
  const headers = ["email", "name", "phone", "course"];
  const rows = [
    ["rahul.sharma@example.com", "Rahul Sharma", "+91 9876543210", "Computer Science"],
    ["priya.patel@example.com", "Priya Patel", "+91 9812345678", "Electronics & Comm"],
    ["ananya.singh@example.com", "Ananya Singh", "+91 9711223344", "Information Tech"],
    ["vikram.verma@example.com", "Vikram Verma", "+91 9654321098", "Mechanical Engg"],
    ["sneha.gupta@example.com", "Sneha Gupta", "+91 9543210987", "Civil Engg"],
  ];

  const csvContent =
    "data:text/csv;charset=utf-8," +
    [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "sample_student_email_list.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
