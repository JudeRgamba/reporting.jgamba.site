<?php
require_once 'auth.php'; // already checks login

if ($_SESSION['role'] !== 'super_admin') {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Super admin access required']);
    exit;
}