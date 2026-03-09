<?php
require_once 'auth.php'; // already checks login

if (!in_array($_SESSION['role'] ?? '', ['owner', 'admin'])) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Admin access required']);
    exit;
}