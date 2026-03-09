<button id="logout-btn">Sign Out</button>

<script>
    document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/logout.php', {
        method: 'POST',
        credentials: 'include'
    });
    window.location.href = '/login.php';
    });
</script>