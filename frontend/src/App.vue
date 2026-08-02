<script setup>
const features = [
  { title: '客户资料', description: '集中维护客户信息，让资料清晰可查。' },
  { title: '跟进记录', description: '持续追踪沟通过程，把握每一次机会。' },
  { title: '数据概览', description: '快速了解业务动态与客户转化情况。' },
]
</script>

<template>
  <main>
    <nav class="nav">
      <a class="brand" href="/">银鼎<span>客资</span></a>
      <a class="admin-link" href="/admin/">进入管理后台</a>
    </nav>

    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">CUSTOMER INFORMATION PLATFORM</p>
        <h1>让每一份客户信息<br /><em>更有价值</em></h1>
        <p class="intro">简洁、高效的客资信息管理平台，为团队提供可靠的客户数据支持。</p>
        <a class="primary-action" href="/admin/">开始管理客户 <span>→</span></a>
      </div>
      <div class="visual" aria-hidden="true">
        <div class="glow"></div>
        <div class="dashboard-card">
          <div class="card-top"><span></span><span></span><span></span></div>
          <div class="metric"><small>客户总览</small><strong>1,286</strong><i>+12.8%</i></div>
          <div class="chart">
            <b style="height: 34%"></b><b style="height: 52%"></b><b style="height: 45%"></b>
            <b style="height: 76%"></b><b style="height: 62%"></b><b style="height: 88%"></b>
          </div>
        </div>
      </div>
    </section>

    <section class="features">
      <article v-for="(feature, index) in features" :key="feature.title">
        <span>0{{ index + 1 }}</span>
        <h2>{{ feature.title }}</h2>
        <p>{{ feature.description }}</p>
      </article>
    </section>
  </main>
</template>
